import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '.';
import { user, userFollow } from './schema';
import { followersCountOf, followingCountOf } from './counters';
import { encodeCursor, type FeedCursor } from './posts';

export const FOLLOW_PAGE_SIZE = 20;
export const FOLLOW_MAX_PAGE_SIZE = 50;

const pair = (followerId: string, followingId: string) =>
	and(eq(userFollow.followerId, followerId), eq(userFollow.followingId, followingId));

/**
 * Follows or unfollows in one D1 batch (one transaction): writes the edge, then recomputes both
 * users' counters from the rows. Idempotent: repeating a follow or unfollow changes nothing.
 * Returns the target's follower count after the change.
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

	const [, target, self] = await db.batch([
		edge,
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
