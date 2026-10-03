import { aliasedTable, and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Database } from '.';
import {
	commentReaction,
	NOTIFICATION_TYPES,
	notification,
	notificationOptOut,
	notificationRead,
	post,
	postComment,
	user,
	type NotificationType
} from './schema';
import { encodeCursor, type FeedCursor } from './posts';
import { notBlockedWith } from './blocks';

/**
 * An action that notifies `recipientId`. Which of `postId` / `commentId` / `storyId` is set
 * depends on `type`.
 */
export interface NotificationTarget {
	type: NotificationType;
	actorId: string;
	recipientId: string;
	postId?: string | null;
	commentId?: string | null;
	storyId?: string | null;
}

/** Notifications older than this are pruned when the user marks Activity read. */
export const NOTIFICATION_RETENTION_MS = 90 * 24 * 3600 * 1000;

/** Cap on the unread badge count, so counting stays cheap for very active accounts. */
export const UNREAD_CAP = 99;

/**
 * One row per action: a like, reaction or repost is per actor and target, a comment or reply is
 * the comment itself, a quote is the quote post, a follow (or follow request, or its acceptance)
 * is per pair, a mention is per post and tagged user. Repeating an action hits the same key;
 * undoing deletes it.
 */
export function dedupeKey(t: NotificationTarget): string {
	switch (t.type) {
		case 'like':
			return `like:${t.actorId}:${t.postId}`;
		case 'comment':
			return `comment:${t.commentId}`;
		case 'reply':
			return `reply:${t.commentId}`;
		case 'reaction':
			return `reaction:${t.actorId}:${t.commentId}`;
		case 'follow':
			return `follow:${t.actorId}:${t.recipientId}`;
		case 'mention':
			return `mention:${t.postId}:${t.recipientId}`;
		case 'story_reaction':
			return `story_reaction:${t.actorId}:${t.storyId}`;
		case 'follow_request':
			return `follow_request:${t.actorId}:${t.recipientId}`;
		case 'follow_accepted':
			return `follow_accepted:${t.actorId}:${t.recipientId}`;
		case 'repost':
			return `repost:${t.actorId}:${t.postId}`;
		case 'quote':
			return `quote:${t.postId}`;
	}
}

/**
 * Statement that records the notification, for the same `db.batch` as the action. For your own
 * actions it is a no-op (so batch result positions stay fixed), and an action already recorded is
 * left as is.
 */
export function notifyStatement(db: Database, t: NotificationTarget) {
	if (t.recipientId === t.actorId) {
		return db.delete(notification).where(sql`0`);
	}
	return db
		.insert(notification)
		.values({
			id: crypto.randomUUID(),
			recipientId: t.recipientId,
			actorId: t.actorId,
			type: t.type,
			postId: t.postId ?? null,
			commentId: t.commentId ?? null,
			dedupeKey: dedupeKey(t)
		})
		.onConflictDoNothing();
}

/** Statement that removes the notification for an undone action (unlike, unfollow). */
export function unnotifyStatement(db: Database, t: NotificationTarget) {
	return db.delete(notification).where(eq(notification.dedupeKey, dedupeKey(t)));
}

/**
 * Removes a reaction notification once the actor has no reactions left on the comment. Must run
 * after the reaction delete in the same batch.
 */
export function unnotifyReactionStatement(
	db: Database,
	t: Omit<NotificationTarget, 'type'> & { commentId: string }
) {
	return db
		.delete(notification)
		.where(
			and(
				eq(notification.dedupeKey, dedupeKey({ ...t, type: 'reaction' })),
				sql`not exists (select 1 from ${commentReaction} where ${commentReaction.commentId} = ${t.commentId} and ${commentReaction.userId} = ${t.actorId})`
			)
		);
}

export interface NotificationRow {
	id: string;
	type: NotificationType;
	createdAt: Date;
	unread: boolean;
	actor: { id: string; name: string; handle: string | null; image: string | null };
	postId: string | null;
	comment: { id: string; content: string } | null;
}

const readAtOf = (userId: string) =>
	sql`coalesce((select ${notificationRead.readAt} from ${notificationRead} where ${notificationRead.userId} = ${userId}), 0)`;

/**
 * A notification is shown only while its post (if any) is live, and never from a user blocked in
 * either direction (new ones are not even stored: see the `notification_block_guard` trigger).
 */
const livePost = or(isNull(notification.postId), isNull(post.deletedAt));

/**
 * One page of the user's notifications, newest first, keyset-paginated on (created_at, id) via
 * `notification_recipientId_createdAt_idx`. The cursor is `<createdAtMs>_<id>`.
 */
export async function listNotifications(
	db: Database,
	userId: string,
	{ limit, cursor }: { limit: number; cursor?: FeedCursor | null }
): Promise<{ items: NotificationRow[]; nextCursor: string | null }> {
	const actor = aliasedTable(user, 'actor');
	const rows = await db
		.select({
			id: notification.id,
			type: notification.type,
			createdAt: notification.createdAt,
			unread: sql<number>`${notification.createdAt} > ${readAtOf(userId)}`,
			actor: { id: actor.id, name: actor.name, handle: actor.handle, image: actor.image },
			postId: notification.postId,
			commentId: notification.commentId,
			commentContent: postComment.content
		})
		.from(notification)
		.innerJoin(actor, eq(actor.id, notification.actorId))
		.leftJoin(post, eq(post.id, notification.postId))
		.leftJoin(postComment, eq(postComment.id, notification.commentId))
		.where(
			and(
				eq(notification.recipientId, userId),
				livePost,
				notBlockedWith(userId, notification.actorId),
				cursor
					? sql`(${notification.createdAt}, ${notification.id}) < (${cursor.createdAt}, ${cursor.id})`
					: undefined
			)
		)
		.orderBy(desc(notification.createdAt), desc(notification.id))
		.limit(limit + 1);

	const hasMore = rows.length > limit;
	const page = hasMore ? rows.slice(0, limit) : rows;
	const last = page.at(-1);
	return {
		items: page.map((r) => ({
			id: r.id,
			type: r.type,
			createdAt: r.createdAt,
			unread: Boolean(r.unread),
			actor: r.actor,
			postId: r.postId,
			comment:
				r.commentId && r.commentContent !== null
					? { id: r.commentId, content: r.commentContent }
					: null
		})),
		nextCursor: hasMore && last ? encodeCursor(last) : null
	};
}

/** Unread notifications (capped at `UNREAD_CAP`) for the Activity badge. */
export async function countUnreadNotifications(db: Database, userId: string): Promise<number> {
	const [row] = await db.select({ n: sql<number>`count(*)` }).from(
		db
			.select({ one: sql`1` })
			.from(notification)
			.leftJoin(post, eq(post.id, notification.postId))
			.where(
				and(
					eq(notification.recipientId, userId),
					sql`${notification.createdAt} > ${readAtOf(userId)}`,
					livePost,
					notBlockedWith(userId, notification.actorId)
				)
			)
			.limit(UNREAD_CAP)
			.as('unread')
	);
	return Number(row?.n ?? 0);
}

/**
 * Marks everything up to `upTo` (the newest notification the user has seen) as read. The marker
 * only moves forward, so a stale tab cannot un-read newer activity. Also prunes old notifications.
 */
export async function markNotificationsRead(
	db: Database,
	userId: string,
	upTo: Date,
	now = Date.now()
): Promise<void> {
	await db.batch([
		db
			.insert(notificationRead)
			.values({ userId, readAt: upTo })
			.onConflictDoUpdate({
				target: notificationRead.userId,
				set: { readAt: sql`max(${notificationRead.readAt}, excluded.read_at)` }
			}),
		db
			.delete(notification)
			.where(
				and(
					eq(notification.recipientId, userId),
					lt(notification.createdAt, new Date(now - NOTIFICATION_RETENTION_MS))
				)
			)
	]);
}

/** Whether each notification type is on for a user. */
export type NotificationPreferences = Record<NotificationType, boolean>;

export async function getNotificationPreferences(
	db: Database,
	userId: string
): Promise<NotificationPreferences> {
	const optOuts = await db
		.select({ type: notificationOptOut.type })
		.from(notificationOptOut)
		.where(eq(notificationOptOut.userId, userId));
	const off = new Set(optOuts.map((o) => o.type));
	return Object.fromEntries(
		NOTIFICATION_TYPES.map((type) => [type, !off.has(type)])
	) as NotificationPreferences;
}

/** Turns the given types on or off in one batch; types left out keep their setting. */
export async function setNotificationPreferences(
	db: Database,
	userId: string,
	changes: Partial<NotificationPreferences>
): Promise<void> {
	const entries = Object.entries(changes) as [NotificationType, boolean][];
	const on = entries.filter(([, enabled]) => enabled).map(([type]) => type);
	const off = entries.filter(([, enabled]) => !enabled).map(([type]) => type);

	const statements: BatchItem<'sqlite'>[] = [];
	if (on.length) {
		statements.push(
			db
				.delete(notificationOptOut)
				.where(and(eq(notificationOptOut.userId, userId), inArray(notificationOptOut.type, on)))
		);
	}
	if (off.length) {
		statements.push(
			db
				.insert(notificationOptOut)
				.values(off.map((type) => ({ userId, type })))
				.onConflictDoNothing()
		);
	}
	if (!statements.length) return;
	await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
}
