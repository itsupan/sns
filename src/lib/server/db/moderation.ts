import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { Database } from '.';
import {
	message,
	moderationAction,
	post,
	postComment,
	report,
	session,
	user,
	type ModerationAction,
	type ReportResolution,
	type ReportTargetType
} from './schema';
import { encodeCursor, loadPostMedia, type FeedCursor, type MediaItem } from './posts';
import { commentRemoval } from './comments';
import { ApiError } from '$lib/server/api/errors';
import { outranks, roleOf, type Role } from '$lib/server/roles';
import type { ResolveAction } from '$lib/moderation';

/** Matches the partial indexes on open reports (a bound parameter would not). */
const isOpen = sql`${report.status} = 'open'`;

const targetKey = (targetType: ReportTargetType, targetId: string) => `${targetType}:${targetId}`;

export interface ModerationUser {
	id: string;
	name: string;
	handle: string | null;
	image: string | null;
	role: Role;
	banned: boolean;
	banExpires: Date | null;
}

/** What a report is about, as moderators see it, whatever the blocks between them and its owner. */
export interface ModerationTarget {
	owner: ModerationUser;
	/** Post content, comment or message text, or the user's bio. */
	text: string | null;
	/** A post's first media item. */
	media: MediaItem | null;
	/** The post a post or comment belongs to. */
	postId: string | null;
	parentCommentId: string | null;
	/** A post or message soft-deleted already. */
	removed: boolean;
}

const ownerColumns = {
	id: user.id,
	name: user.name,
	handle: user.handle,
	image: user.image,
	role: user.role,
	banned: user.banned,
	banExpires: user.banExpires
};

function toOwner(row: {
	id: string;
	name: string;
	handle: string | null;
	image: string | null;
	role: string | null;
	banned: boolean | null;
	banExpires: Date | null;
}): ModerationUser {
	return { ...row, role: roleOf(row), banned: row.banned ?? false };
}

/**
 * Report targets keyed by `<type>:<id>`, one query per target type (callers pass at most a page).
 * Missing keys are targets that no longer exist: deleted comments and accounts, or a comment
 * whose post was deleted.
 */
export async function loadModerationTargets(
	db: Database,
	refs: { targetType: ReportTargetType; targetId: string }[]
): Promise<Map<string, ModerationTarget>> {
	const idsOf = (type: ReportTargetType) =>
		refs.filter((r) => r.targetType === type).map((r) => r.targetId);
	const [postIds, commentIds, userIds, messageIds] = (
		['post', 'comment', 'user', 'message'] as const
	).map(idsOf);

	const [posts, media, comments, users, messages] = await Promise.all([
		postIds.length
			? db
					.select({
						id: post.id,
						content: post.content,
						deletedAt: post.deletedAt,
						owner: ownerColumns
					})
					.from(post)
					.innerJoin(user, eq(user.id, post.userId))
					.where(inArray(post.id, postIds))
			: [],
		loadPostMedia(db, postIds),
		commentIds.length
			? db
					.select({
						id: postComment.id,
						content: postComment.content,
						postId: postComment.postId,
						parentCommentId: postComment.parentCommentId,
						owner: ownerColumns
					})
					.from(postComment)
					.innerJoin(post, eq(post.id, postComment.postId))
					.innerJoin(user, eq(user.id, postComment.userId))
					.where(and(inArray(postComment.id, commentIds), isNull(post.deletedAt)))
			: [],
		userIds.length
			? db
					.select({ bio: user.bio, owner: ownerColumns })
					.from(user)
					.where(inArray(user.id, userIds))
			: [],
		messageIds.length
			? db
					.select({
						id: message.id,
						content: message.content,
						deletedAt: message.deletedAt,
						owner: ownerColumns
					})
					.from(message)
					.innerJoin(user, eq(user.id, message.senderId))
					.where(inArray(message.id, messageIds))
			: []
	]);

	const targets = new Map<string, ModerationTarget>();
	const base = { media: null, postId: null, parentCommentId: null, removed: false };
	for (const p of posts) {
		targets.set(targetKey('post', p.id), {
			...base,
			owner: toOwner(p.owner),
			text: p.content,
			media: media.get(p.id)?.[0] ?? null,
			postId: p.id,
			removed: p.deletedAt !== null
		});
	}
	for (const c of comments) {
		targets.set(targetKey('comment', c.id), {
			...base,
			owner: toOwner(c.owner),
			text: c.content,
			postId: c.postId,
			parentCommentId: c.parentCommentId
		});
	}
	for (const u of users) {
		targets.set(targetKey('user', u.owner.id), { ...base, owner: toOwner(u.owner), text: u.bio });
	}
	for (const m of messages) {
		targets.set(targetKey('message', m.id), {
			...base,
			owner: toOwner(m.owner),
			text: m.content,
			removed: m.deletedAt !== null
		});
	}
	return targets;
}

export interface QueueItem {
	targetType: ReportTargetType;
	targetId: string;
	reportCount: number;
	reasons: string[];
	latestReportAt: Date;
	/** Null when the target no longer exists. */
	target: ModerationTarget | null;
}

/**
 * One page of the moderation queue: open reports grouped by target, most recently reported
 * first, keyset-paginated on (newest report time, target key) via `report_open_target_createdAt_idx`.
 */
export async function loadReportQueue(
	db: Database,
	{ limit, cursor }: { limit: number; cursor?: FeedCursor | null }
): Promise<{ items: QueueItem[]; nextCursor: string | null }> {
	const latestAt = sql<number>`max(${report.createdAt})`;
	const key = sql<string>`${report.targetType} || ':' || ${report.targetId}`;
	const rows = await db
		.select({
			targetType: report.targetType,
			targetId: report.targetId,
			reportCount: sql<number>`count(*)`,
			reasons: sql<string>`group_concat(distinct ${report.reason})`,
			latestAt
		})
		.from(report)
		.where(isOpen)
		.groupBy(report.targetType, report.targetId)
		.having(cursor ? sql`(${latestAt}, ${key}) < (${cursor.createdAt}, ${cursor.id})` : undefined)
		.orderBy(desc(latestAt), desc(key))
		.limit(limit + 1);

	const page = rows.slice(0, limit);
	const targets = await loadModerationTargets(db, page);
	const items = page.map((row) => ({
		targetType: row.targetType,
		targetId: row.targetId,
		reportCount: Number(row.reportCount),
		reasons: row.reasons.split(','),
		latestReportAt: new Date(Number(row.latestAt)),
		target: targets.get(targetKey(row.targetType, row.targetId)) ?? null
	}));
	const last = items.at(-1);
	return {
		items,
		nextCursor:
			rows.length > limit && last
				? encodeCursor({
						createdAt: last.latestReportAt,
						id: targetKey(last.targetType, last.targetId)
					})
				: null
	};
}

const RESOLUTION: Record<ResolveAction, ReportResolution> = {
	dismiss: 'dismissed',
	remove_content: 'content_removed',
	suspend_user: 'user_suspended'
};

type Actor = { id: string; role?: string | null };

function requireNotSelf(actor: Actor, target: ModerationUser) {
	if (target.id === actor.id) {
		throw new ApiError(403, 'forbidden', 'You cannot moderate yourself or your own content');
	}
}

/** Throws unless `actor` may act on `target`: never on themselves, and only on lower roles. */
function requireOutranks(actor: Actor, target: ModerationUser) {
	requireNotSelf(actor, target);
	if (!outranks(actor, target)) {
		throw new ApiError(403, 'forbidden', 'You cannot moderate a moderator or admin');
	}
}

/** The statements that suspend a user until `expires` (null: indefinitely) and sign them out. */
function suspension(db: Database, userId: string, reason: string | null, expires: Date | null) {
	return [
		db
			.update(user)
			.set({ banned: true, banReason: reason, banExpires: expires })
			.where(eq(user.id, userId)),
		db.delete(session).where(eq(session.userId, userId))
	] as const;
}

/**
 * Takes `action` on a reported target and closes every open report on it, writing the audit
 * row in the same batch. Removing content soft-deletes a post or message and deletes a comment
 * (with its replies); suspending acts on the target's owner.
 */
export async function resolveReports(
	db: Database,
	{
		moderator,
		targetType,
		targetId,
		action,
		durationDays,
		note
	}: {
		moderator: Actor;
		targetType: ReportTargetType;
		targetId: string;
		action: ResolveAction;
		durationDays: number | null;
		note: string | null;
	}
): Promise<void> {
	if (action === 'remove_content' && targetType === 'user') {
		throw new ApiError(400, 'bad_request', 'An account cannot be removed; suspend it instead');
	}
	const openReports = and(isOpen, eq(report.targetType, targetType), eq(report.targetId, targetId));
	const [newest] = await db
		.select({ id: report.id })
		.from(report)
		.where(openReports)
		.orderBy(desc(report.createdAt))
		.limit(1);
	if (!newest) throw new ApiError(404, 'not_found', 'No open reports on this content');

	const target = (await loadModerationTargets(db, [{ targetType, targetId }])).get(
		targetKey(targetType, targetId)
	);
	if (target) requireNotSelf(moderator, target.owner);

	const now = new Date();
	const close = db
		.update(report)
		.set({
			status: action === 'dismiss' ? 'dismissed' : 'resolved',
			resolution: RESOLUTION[action],
			resolvedBy: moderator.id,
			resolvedAt: now
		})
		.where(openReports);
	const audit = (type: ReportTargetType, id: string) =>
		db.insert(moderationAction).values({
			id: crypto.randomUUID(),
			moderatorId: moderator.id,
			action,
			targetType: type,
			targetId: id,
			reportId: newest.id,
			note,
			createdAt: now
		});

	if (action === 'dismiss') {
		await db.batch([close, audit(targetType, targetId)]);
		return;
	}
	if (!target) throw new ApiError(404, 'not_found', 'Content not found');
	requireOutranks(moderator, target.owner);

	if (action === 'suspend_user') {
		const expires = durationDays ? new Date(now.getTime() + durationDays * 86_400_000) : null;
		await db.batch([
			...suspension(db, target.owner.id, note, expires),
			close,
			audit('user', target.owner.id)
		]);
		return;
	}

	if (target.removed) throw new ApiError(409, 'conflict', 'This content was already removed');
	const removal = audit(targetType, targetId);
	switch (targetType) {
		case 'post':
			await db.batch([
				db.update(post).set({ deletedAt: now }).where(eq(post.id, targetId)),
				close,
				removal
			]);
			return;
		case 'message':
			await db.batch([
				db.update(message).set({ deletedAt: now }).where(eq(message.id, targetId)),
				close,
				removal
			]);
			return;
		case 'comment': {
			const { remove, updatePost, updateParent } = commentRemoval(db, {
				id: targetId,
				postId: target.postId!,
				parentCommentId: target.parentCommentId
			});
			await db.batch(
				updateParent
					? [remove, updatePost, updateParent, close, removal]
					: [remove, updatePost, close, removal]
			);
			return;
		}
	}
}

/** Staff (moderators and admins), newest first, keyset-paginated on (created_at, id). */
export async function listStaff(
	db: Database,
	{ limit, cursor }: { limit: number; cursor?: FeedCursor | null }
) {
	const rows = await db
		.select({ ...ownerColumns, createdAt: user.createdAt })
		.from(user)
		.where(
			and(
				inArray(user.role, ['moderator', 'admin']),
				cursor
					? sql`(${user.createdAt}, ${user.id}) < (${cursor.createdAt}, ${cursor.id})`
					: undefined
			)
		)
		.orderBy(desc(user.createdAt), desc(user.id))
		.limit(limit + 1);
	const page = rows.slice(0, limit);
	const last = page.at(-1);
	return {
		users: page.map((row) => toOwner(row)),
		nextCursor: rows.length > limit && last ? encodeCursor(last) : null
	};
}

/** A user by id or handle (with or without '@'), or a 404. */
export async function requireUserByIdOrHandle(db: Database, idOrHandle: string) {
	const handle = idOrHandle.replace(/^@/, '');
	const [row] = await db
		.select(ownerColumns)
		.from(user)
		.where(or(eq(user.id, idOrHandle), eq(user.handle, handle)))
		.limit(1);
	if (!row) throw new ApiError(404, 'not_found', 'User not found');
	return toOwner(row);
}

function auditRow(admin: Actor, action: ModerationAction, userId: string, note: string | null) {
	return {
		id: crypto.randomUUID(),
		moderatorId: admin.id,
		action,
		targetType: 'user' as const,
		targetId: userId,
		note
	};
}

/** Makes a plain user a moderator (`grant`) or a moderator a plain user again, with an audit row. */
export async function setModerator(
	db: Database,
	{ admin, target, grant }: { admin: Actor; target: ModerationUser; grant: boolean }
): Promise<void> {
	if (target.id === admin.id)
		throw new ApiError(403, 'forbidden', 'You cannot change your own role');
	const from: Role = grant ? 'user' : 'moderator';
	if (target.role !== from) {
		throw new ApiError(
			409,
			'conflict',
			grant ? 'This user is already a moderator or admin' : 'This user is not a moderator'
		);
	}
	await db.batch([
		db
			.update(user)
			.set({ role: grant ? 'moderator' : 'user' })
			.where(eq(user.id, target.id)),
		db
			.insert(moderationAction)
			.values(auditRow(admin, grant ? 'grant_moderator' : 'revoke_moderator', target.id, null))
	]);
}

/** Lifts a user's suspension, with an audit row. */
export async function unsuspendUser(
	db: Database,
	{ admin, target, note }: { admin: Actor; target: ModerationUser; note: string | null }
): Promise<void> {
	requireOutranks(admin, target);
	if (!target.banned) throw new ApiError(409, 'conflict', 'This user is not suspended');
	await db.batch([
		db
			.update(user)
			.set({ banned: false, banReason: null, banExpires: null })
			.where(eq(user.id, target.id)),
		db.insert(moderationAction).values(auditRow(admin, 'unsuspend_user', target.id, note))
	]);
}
