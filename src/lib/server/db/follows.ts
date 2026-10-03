import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { Database } from '.';
import { followRequest, notification, user, userFollow } from './schema';
import { followersCountOf, followingCountOf } from './counters';
import { encodeCursor, type FeedCursor } from './posts';
import { dedupeKey, notifyStatement, unnotifyStatement } from './notifications';
import type { FollowStatus } from '$lib/utils/follow.svelte';
import type { FollowRequestPage, FollowRequestUser } from '$lib/activity/types';

export const FOLLOW_PAGE_SIZE = 20;
export const FOLLOW_MAX_PAGE_SIZE = 50;

const pair = (followerId: string, followingId: string) =>
	and(eq(userFollow.followerId, followerId), eq(userFollow.followingId, followingId));

const requestPair = (requesterId: string, targetId: string) =>
	and(eq(followRequest.requesterId, requesterId), eq(followRequest.targetId, targetId));

/**
 * Follows or unfollows in one D1 batch (one transaction): writes the edge, then recomputes both
 * users' counters from the rows. Either way any pending request between the pair is gone after:
 * a follow settles it and an unfollow cancels it. Idempotent: repeating a follow or unfollow
 * changes nothing. Returns the target's follower count after the change.
 */
export async function setFollowing(
	db: Database,
	followerId: string,
	followingId: string,
	follow: boolean
): Promise<{ followersCount: number; followingCount: number }> {
	const edge = follow
		? db.insert(userFollow).values({ followerId, followingId }).onConflictDoNothing()
		: db.delete(userFollow).where(pair(followerId, followingId));

	const notice = { type: 'follow', actorId: followerId, recipientId: followingId } as const;
	const [, , , , target, self] = await db.batch([
		db.delete(followRequest).where(requestPair(followerId, followingId)),
		unnotifyStatement(db, { ...notice, type: 'follow_request' }),
		edge,
		follow ? notifyStatement(db, notice) : unnotifyStatement(db, notice),
		db
			.update(user)
			.set({ followersCount: followersCountOf(followingId) })
			.where(eq(user.id, followingId))
			.returning({ followersCount: user.followersCount }),
		db
			.update(user)
			.set({ followingCount: followingCountOf(followerId) })
			.where(eq(user.id, followerId))
			.returning({ followingCount: user.followingCount })
	]);

	return {
		followersCount: target[0]?.followersCount ?? 0,
		followingCount: self[0]?.followingCount ?? 0
	};
}

export async function isFollowing(db: Database, followerId: string, followingId: string) {
	const rows = await db
		.select({ followerId: userFollow.followerId })
		.from(userFollow)
		.where(pair(followerId, followingId))
		.limit(1);
	return rows.length > 0;
}

/** Asks to follow the private account `targetId` and notifies it. Idempotent. */
export async function requestFollow(db: Database, requesterId: string, targetId: string) {
	await db.batch([
		db.insert(followRequest).values({ requesterId, targetId }).onConflictDoNothing(),
		notifyStatement(db, { type: 'follow_request', actorId: requesterId, recipientId: targetId })
	]);
}

/** Withdraws or declines a pending request, with its notification. Idempotent. */
export async function deleteFollowRequest(db: Database, requesterId: string, targetId: string) {
	await db.batch([
		db.delete(followRequest).where(requestPair(requesterId, targetId)),
		unnotifyStatement(db, { type: 'follow_request', actorId: requesterId, recipientId: targetId })
	]);
}

/**
 * Statements approving `targetId`'s pending requests (only `requesterId`'s when given), for one
 * `db.batch`: each becomes a follow, notifies its requester, and the counters are recomputed.
 * Set-based on the request rows, so approving every request at once binds a fixed number of
 * parameters however many are pending. The last but one statement returns the approved ids.
 */
export function approvalStatements(db: Database, targetId: string, requesterId?: string) {
	const pending = and(
		eq(followRequest.targetId, targetId),
		requesterId ? eq(followRequest.requesterId, requesterId) : undefined
	) as SQL;
	const requesters = db
		.select({ id: followRequest.requesterId })
		.from(followRequest)
		.where(pending);
	// `dedupeKey` ends with the recipient, so SQL appends each requester's id to the shared prefix.
	const acceptedKeyPrefix = dedupeKey({
		type: 'follow_accepted',
		actorId: targetId,
		recipientId: ''
	});
	return [
		db
			.insert(userFollow)
			.select(
				sql`select requester_id, target_id, cast(unixepoch('subsecond') * 1000 as integer) from ${followRequest} where ${pending}`
			)
			.onConflictDoNothing(),
		db
			.insert(notification)
			.select(
				sql`select lower(hex(randomblob(16))), requester_id, target_id, 'follow_accepted', null, null, ${acceptedKeyPrefix} || requester_id, cast(unixepoch('subsecond') * 1000 as integer) from ${followRequest} where ${pending}`
			)
			.onConflictDoNothing(),
		db
			.update(user)
			.set({
				followingCount: sql`(select count(*) from ${userFollow} where ${userFollow.followerId} = ${user.id})`
			})
			.where(inArray(user.id, requesters)),
		db
			.delete(notification)
			.where(
				and(
					eq(notification.type, 'follow_request'),
					eq(notification.recipientId, targetId),
					inArray(notification.actorId, requesters)
				)
			),
		db.delete(followRequest).where(pending).returning({ requesterId: followRequest.requesterId }),
		db
			.update(user)
			.set({ followersCount: followersCountOf(targetId) })
			.where(eq(user.id, targetId))
	] as const;
}

/** Approves one pending request. False when there was none (already handled or withdrawn). */
export async function approveFollowRequest(
	db: Database,
	targetId: string,
	requesterId: string
): Promise<boolean> {
	const [, , , , approved] = await db.batch(approvalStatements(db, targetId, requesterId));
	return approved.length > 0;
}

/** The viewer's follow status towards `targetId`, in one query. */
export async function followStatus(
	db: Database,
	viewerId: string,
	targetId: string
): Promise<FollowStatus> {
	const [row] = await db.all<{ following: number; requested: number }>(
		sql`select exists(select 1 from ${userFollow} where ${pair(viewerId, targetId)}) as following, exists(select 1 from ${followRequest} where ${requestPair(viewerId, targetId)}) as requested`
	);
	return row?.following ? 'following' : row?.requested ? 'requested' : 'none';
}

/**
 * One page of the requests to follow `targetId`, newest first, keyset-paginated on
 * (created_at, requester id) via `follow_request_targetId_createdAt_idx`.
 */
export async function listFollowRequests(
	db: Database,
	targetId: string,
	{ limit, cursor }: { limit: number; cursor?: FeedCursor | null }
): Promise<FollowRequestPage> {
	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			handle: user.handle,
			image: user.image,
			createdAt: followRequest.createdAt
		})
		.from(followRequest)
		.innerJoin(user, eq(user.id, followRequest.requesterId))
		.where(
			and(
				eq(followRequest.targetId, targetId),
				cursor
					? sql`(${followRequest.createdAt}, ${followRequest.requesterId}) < (${cursor.createdAt}, ${cursor.id})`
					: undefined
			)
		)
		.orderBy(desc(followRequest.createdAt), desc(followRequest.requesterId))
		.limit(limit + 1);

	const hasMore = rows.length > limit;
	const page = hasMore ? rows.slice(0, limit) : rows;
	const last = page.at(-1);
	const users: FollowRequestUser[] = page.map(({ createdAt, ...u }) => ({
		...u,
		requestedAt: createdAt.getTime()
	}));
	return {
		users,
		nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null
	};
}

/** Which of `userIds` the viewer follows, in one query (feed cards show Follow / Following). */
export async function loadFollowedIds(
	db: Database,
	viewerId: string | null | undefined,
	userIds: string[]
): Promise<Set<string>> {
	const ids = [...new Set(userIds)].filter((id) => id !== viewerId);
	if (!viewerId || ids.length === 0) return new Set();
	const rows = await db
		.select({ id: userFollow.followingId })
		.from(userFollow)
		.where(and(eq(userFollow.followerId, viewerId), inArray(userFollow.followingId, ids)));
	return new Set(rows.map((r) => r.id));
}

export interface FollowListUser {
	id: string;
	name: string;
	handle: string | null;
	image: string | null;
	/** When this follow happened (ms). */
	followedAt: number;
	/** Whether the viewer follows this user (false when signed out or for the viewer themself). */
	isFollowing: boolean;
}

/**
 * One page of a user's followers or followings, newest follow first. Keyset pagination on
 * (created_at, other user id), served by the `user_follow_*_createdAt_idx` indexes.
 */
export async function listFollows(
	db: Database,
	{
		userId,
		direction,
		viewerId,
		limit,
		cursor
	}: {
		userId: string;
		direction: 'followers' | 'following';
		viewerId?: string | null;
		limit: number;
		cursor?: FeedCursor | null;
	}
) {
	// followers: rows pointing at userId, listing who follows; following: rows from userId.
	const self = direction === 'followers' ? userFollow.followingId : userFollow.followerId;
	const other = direction === 'followers' ? userFollow.followerId : userFollow.followingId;

	const viewerFollows = viewerId
		? sql<number>`exists(select 1 from ${userFollow} v where v.follower_id = ${viewerId} and v.following_id = ${user.id})`
		: sql<number>`0`;

	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			handle: user.handle,
			image: user.image,
			createdAt: userFollow.createdAt,
			isFollowing: viewerFollows
		})
		.from(userFollow)
		.innerJoin(user, eq(user.id, other))
		.where(
			and(
				eq(self, userId),
				cursor
					? sql`(${userFollow.createdAt}, ${other}) < (${cursor.createdAt}, ${cursor.id})`
					: undefined
			)
		)
		.orderBy(desc(userFollow.createdAt), desc(other))
		.limit(limit + 1);

	const hasMore = rows.length > limit;
	const page = hasMore ? rows.slice(0, limit) : rows;
	const last = page.at(-1);

	const users: FollowListUser[] = page.map((r) => ({
		id: r.id,
		name: r.name,
		handle: r.handle,
		image: r.image,
		followedAt: r.createdAt.getTime(),
		isFollowing: r.id !== viewerId && Boolean(r.isFollowing)
	}));

	return {
		users,
		hasMore,
		nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null
	};
}
