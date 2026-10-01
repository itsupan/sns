import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Database } from '.';
import { conversation, conversationMember, message, user } from './schema';
import { encodeCursor, type FeedCursor } from './posts';
import { ApiError } from '$lib/server/api/errors';
import { requireNotBlocked } from './blocks';
import { displayHandle } from '$lib/utils/format';
import type { ChatMessage, ChatUser, InboxItem } from '$lib/chat/types';

/**
 * Catch-up after a reconnect re-reads this much history before the last message the client
 * has. Two messages can share a created_at millisecond and then sort by random id, so an
 * exact `> last` could skip one; the overlap is deduped by id on the client.
 */
export const CATCH_UP_OVERLAP_MS = 2000;

/**
 * A `conversation_member` column, always table-qualified. Drizzle leaves columns unqualified in
 * single-table queries, and inside a correlated subquery on `message` an unqualified
 * `conversation_id` would silently bind to the message's own column.
 */
const memberCol = (column: 'conversation_id' | 'last_read_at') =>
	sql`${conversationMember}.${sql.identifier(column)}`;

/** Unread messages in the outer `conversation_member` row's conversation, for `userId`. */
const unreadCountOf = (userId: string) =>
	sql<number>`(select count(*) from ${message} um where um.conversation_id = ${memberCol('conversation_id')} and um.deleted_at is null and um.sender_id != ${userId} and um.created_at > coalesce(${memberCol('last_read_at')}, 0))`;

/** Stable key for the DM between two users, whichever of them starts it. */
export const dmKey = (a: string, b: string) => [a, b].sort().join(':');

const toChatUser = (u: {
	id: string;
	name: string;
	handle: string | null;
	image: string | null;
}): ChatUser => ({
	id: u.id,
	name: u.name,
	handle: displayHandle(u.handle, u.name),
	slug: u.handle ? u.handle.replace(/^@/, '') : u.id,
	image: u.image
});

const toMessage = (m: typeof message.$inferSelect): ChatMessage => ({
	id: m.id,
	conversationId: m.conversationId,
	senderId: m.senderId,
	content: m.content,
	createdAt: m.createdAt.getTime(),
	...(m.storyRef ? { storyRef: m.storyRef } : {})
});

/**
 * Returns the DM between `userId` and `otherId`, creating it on first use. Idempotent and safe
 * under concurrency: the unique `dm_key` makes both racers land on the same row. 403 when either
 * user blocked the other.
 */
export async function getOrCreateDm(
	db: Database,
	userId: string,
	otherId: string
): Promise<{ id: string; other: ChatUser; created: boolean }> {
	if (userId === otherId) {
		throw new ApiError(400, 'invalid_recipient', 'You cannot message yourself');
	}
	const [other] = await db
		.select({ id: user.id, name: user.name, handle: user.handle, image: user.image })
		.from(user)
		.where(eq(user.id, otherId))
		.limit(1);
	if (!other) throw new ApiError(404, 'not_found', 'User not found');
	await requireNotBlocked(db, userId, otherId, 'You cannot message this user');

	const key = dmKey(userId, otherId);
	const inserted = await db
		.insert(conversation)
		.values({ id: crypto.randomUUID(), dmKey: key })
		.onConflictDoNothing()
		.returning({ id: conversation.id });
	const [row] = inserted.length
		? inserted
		: await db
				.select({ id: conversation.id })
				.from(conversation)
				.where(eq(conversation.dmKey, key))
				.limit(1);

	await db
		.insert(conversationMember)
		.values([
			{ conversationId: row.id, userId },
			{ conversationId: row.id, userId: otherId }
		])
		.onConflictDoNothing();

	return { id: row.id, other: toChatUser(other), created: inserted.length > 0 };
}

/**
 * The conversation if `userId` is a member, with the other member. Non-members get the same
 * 404 as a missing conversation, so ids cannot be probed.
 */
export async function requireMembership(db: Database, conversationId: string, userId: string) {
	const [row] = await db
		.select({
			lastReadAt: conversationMember.lastReadAt,
			other: { id: user.id, name: user.name, handle: user.handle, image: user.image }
		})
		.from(conversationMember)
		.innerJoin(
			sql`${conversationMember} as o`,
			sql`o.conversation_id = ${conversationMember.conversationId} and o.user_id != ${userId}`
		)
		.innerJoin(user, sql`${user.id} = o.user_id`)
		.where(
			and(
				eq(conversationMember.conversationId, conversationId),
				eq(conversationMember.userId, userId)
			)
		)
		.limit(1);
	if (!row) throw new ApiError(404, 'not_found', 'Conversation not found');
	return { id: conversationId, other: toChatUser(row.other), lastReadAt: row.lastReadAt };
}

/**
 * The member's conversations that have messages, most recent first, each with the other
 * member, the last message and the unread count. Keyset on (last_message_at, conversation_id)
 * served by `conversation_member_userId_lastMessageAt_idx`.
 */
export async function listInbox(
	db: Database,
	{ userId, limit, cursor }: { userId: string; limit: number; cursor?: FeedCursor | null }
): Promise<{ conversations: InboxItem[]; hasMore: boolean; nextCursor: string | null }> {
	const m = conversationMember;
	// One column of the conversation's newest live message (served by the message index).
	const last = (column: 'content' | 'sender_id' | 'created_at') =>
		sql`(select lm.${sql.identifier(column)} from ${message} lm where lm.conversation_id = ${memberCol('conversation_id')} and lm.deleted_at is null order by lm.created_at desc, lm.id desc limit 1)`;

	const rows = await db
		.select({
			conversationId: m.conversationId,
			lastMessageAt: m.lastMessageAt,
			lastContent: sql<string | null>`${last('content')}`,
			lastSenderId: sql<string | null>`${last('sender_id')}`,
			lastCreatedAt: sql<number | null>`${last('created_at')}`,
			unreadCount: unreadCountOf(userId),
			other: { id: user.id, name: user.name, handle: user.handle, image: user.image }
		})
		.from(m)
		.innerJoin(
			sql`${conversationMember} as o`,
			sql`o.conversation_id = ${m.conversationId} and o.user_id != ${userId}`
		)
		.innerJoin(user, sql`${user.id} = o.user_id`)
		.where(
			and(
				eq(m.userId, userId),
				isNotNull(m.lastMessageAt),
				cursor
					? sql`(${m.lastMessageAt}, ${m.conversationId}) < (${cursor.createdAt}, ${cursor.id})`
					: undefined
			)
		)
		.orderBy(desc(m.lastMessageAt), desc(m.conversationId))
		.limit(limit + 1);

	const hasMore = rows.length > limit;
	const page = hasMore ? rows.slice(0, limit) : rows;
	const tail = page.at(-1);
	return {
		conversations: page.map((r) => ({
			id: r.conversationId,
			other: toChatUser(r.other),
			lastMessage:
				r.lastContent !== null && r.lastSenderId !== null && r.lastCreatedAt !== null
					? {
							content: r.lastContent,
							senderId: r.lastSenderId,
							createdAt: Number(r.lastCreatedAt)
						}
					: null,
			unreadCount: Number(r.unreadCount)
		})),
		hasMore,
		nextCursor:
			hasMore && tail?.lastMessageAt
				? encodeCursor({ createdAt: tail.lastMessageAt, id: tail.conversationId })
				: null
	};
}

/**
 * A page of history. Without `after`: the newest `limit` messages before `cursor` (older
 * pages as the user scrolls up). With `after` (a message id): messages since that one,
 * for catching up after a reconnect, overlapping by CATCH_UP_OVERLAP_MS. With `strict` too:
 * only messages strictly after it, so paging forward always makes progress even when a whole
 * page falls inside the overlap window. Always oldest first.
 */
export async function listMessages(
	db: Database,
	{
		conversationId,
		limit,
		cursor,
		after,
		strict
	}: {
		conversationId: string;
		limit: number;
		cursor?: FeedCursor | null;
		after?: string | null;
		strict?: boolean;
	}
): Promise<{ messages: ChatMessage[]; hasMore: boolean; nextCursor: string | null }> {
	const live = and(eq(message.conversationId, conversationId), isNull(message.deletedAt));

	if (after) {
		const [anchor] = await db
			.select({ createdAt: message.createdAt })
			.from(message)
			.where(and(eq(message.id, after), eq(message.conversationId, conversationId)))
			.limit(1);
		if (!anchor)
			throw new ApiError(400, 'validation_failed', 'Unknown message', { after: 'Unknown message' });
		const rows = await db
			.select()
			.from(message)
			.where(
				and(
					live,
					strict
						? sql`(${message.createdAt}, ${message.id}) > (${anchor.createdAt.getTime()}, ${after})`
						: sql`${message.createdAt} >= ${anchor.createdAt.getTime() - CATCH_UP_OVERLAP_MS}`
				)
			)
			.orderBy(asc(message.createdAt), asc(message.id))
			.limit(limit + 1);
		const hasMore = rows.length > limit;
		return { messages: rows.slice(0, limit).map(toMessage), hasMore, nextCursor: null };
	}

	const rows = await db
		.select()
		.from(message)
		.where(
			and(
				live,
				cursor
					? sql`(${message.createdAt}, ${message.id}) < (${cursor.createdAt}, ${cursor.id})`
					: undefined
			)
		)
		.orderBy(desc(message.createdAt), desc(message.id))
		.limit(limit + 1);

	const hasMore = rows.length > limit;
	const page = (hasMore ? rows.slice(0, limit) : rows).reverse();
	const oldest = page[0];
	return {
		messages: page.map(toMessage),
		hasMore,
		nextCursor: hasMore && oldest ? encodeCursor(oldest) : null
	};
}

/**
 * Stores a message and, in the same D1 batch (one transaction), bumps the conversation's and
 * every member's `last_message_at` and marks it read for the sender. `created_at` comes from
 * D1 so all messages share one clock.
 *
 * Idempotent on `id`: the client generates it, so retrying a send whose response was lost
 * returns the stored message (`created: false`) instead of posting it twice. An id that belongs
 * to a different conversation or sender is a 409. The timestamp updates only move forward, so a
 * late replay can never rewind a read marker.
 */
export async function sendMessage(
	db: Database,
	{
		id = crypto.randomUUID(),
		conversationId,
		senderId,
		content,
		storyRef = null
	}: {
		id?: string;
		conversationId: string;
		senderId: string;
		content: string;
		storyRef?: string | null;
	}
): Promise<{ message: ChatMessage; created: boolean }> {
	// NULL when `id` is someone else's message, which leaves every column below unchanged.
	const sentAt = sql`(select ${message.createdAt} from ${message} where ${message.id} = ${id} and ${message.conversationId} = ${conversationId} and ${message.senderId} = ${senderId})`;
	const later = (column: SQLiteColumn) =>
		sql`coalesce(max(${column}, ${sentAt}), ${column}, ${sentAt})`;

	const [inserted] = await db.batch([
		db
			.insert(message)
			.values({ id, conversationId, senderId, content, storyRef })
			.onConflictDoNothing()
			.returning(),
		db
			.update(conversation)
			.set({ lastMessageAt: later(conversation.lastMessageAt) })
			.where(eq(conversation.id, conversationId)),
		db
			.update(conversationMember)
			.set({ lastMessageAt: later(conversationMember.lastMessageAt) })
			.where(eq(conversationMember.conversationId, conversationId)),
		db
			.update(conversationMember)
			.set({ lastReadAt: later(conversationMember.lastReadAt) })
			.where(
				and(
					eq(conversationMember.conversationId, conversationId),
					eq(conversationMember.userId, senderId)
				)
			)
	]);
	if (inserted[0]) return { message: toMessage(inserted[0]), created: true };

	const [existing] = await db.select().from(message).where(eq(message.id, id)).limit(1);
	if (!existing || existing.conversationId !== conversationId || existing.senderId !== senderId) {
		throw new ApiError(409, 'conflict', 'That message id is already in use');
	}
	return { message: toMessage(existing), created: false };
}

/** Marks everything up to the conversation's latest message as read for `userId`. */
export async function markRead(db: Database, conversationId: string, userId: string) {
	await db
		.update(conversationMember)
		.set({
			lastReadAt: sql`max(coalesce(${conversationMember.lastReadAt}, 0), coalesce(${conversationMember.lastMessageAt}, 0))`
		})
		.where(
			and(
				eq(conversationMember.conversationId, conversationId),
				eq(conversationMember.userId, userId)
			)
		);
}

/** Total unread messages across the user's conversations (header badge). */
export async function countUnread(db: Database, userId: string): Promise<number> {
	const [row] = await db
		.select({
			n: sql<number>`coalesce(sum(${unreadCountOf(userId)}), 0)`
		})
		.from(conversationMember)
		.where(
			and(
				eq(conversationMember.userId, userId),
				isNotNull(conversationMember.lastMessageAt),
				sql`${conversationMember.lastMessageAt} > coalesce(${conversationMember.lastReadAt}, 0)`
			)
		);
	return Number(row?.n ?? 0);
}
