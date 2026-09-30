import { and, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Database } from '.';
import { user, userBlock, userFollow } from './schema';
import { followersCountOf, followingCountOf } from './counters';
import { unnotifyStatement } from './notifications';
import { ApiError } from '$lib/server/api/errors';

const pair = (blockerId: string, blockedId: string) =>
	and(eq(userBlock.blockerId, blockerId), eq(userBlock.blockedId, blockedId));

/** Ids of everyone `viewerId` blocked or was blocked by, as one SQL subquery. */
const blockedIdsSql = (viewerId: string) =>
	sql`select ${userBlock.blockedId} from ${userBlock} where ${userBlock.blockerId} = ${viewerId} union select ${userBlock.blockerId} from ${userBlock} where ${userBlock.blockedId} = ${viewerId}`;

/**
 * Condition keeping only rows whose `column` (a user id) is not blocked in either direction with
 * the viewer. `undefined` (no filter) when signed out, so it can go straight into `and(...)`.
 */
export function notBlockedWith(
	viewerId: string | null | undefined,
	column: SQLiteColumn | SQL
): SQL | undefined {
	return viewerId ? sql`${column} not in (${blockedIdsSql(viewerId)})` : undefined;
}

/** Ids of users the viewer blocked or who blocked the viewer. */
export async function blockedUserIds(
	db: Database,
	viewerId: string | null | undefined
): Promise<string[]> {
	if (!viewerId) return [];
	const rows = await db.all<{ id: string }>(
		sql`select ${userBlock.blockedId} as id from ${userBlock} where ${userBlock.blockerId} = ${viewerId} union select ${userBlock.blockerId} as id from ${userBlock} where ${userBlock.blockedId} = ${viewerId}`
	);
	return rows.map((r) => r.id);
}

/** Who blocked whom between two users: `blocked` when `a` blocked `b`, `blockedBy` when `b` blocked `a`. */
export async function blockStatus(db: Database, a: string, b: string) {
	const rows = await db
		.select({ blockerId: userBlock.blockerId })
		.from(userBlock)
		.where(or(pair(a, b), pair(b, a)));
	return {
		blocked: rows.some((r) => r.blockerId === a),
		blockedBy: rows.some((r) => r.blockerId === b)
	};
}

/** Throws 403 when either user blocked the other. */
export async function requireNotBlocked(db: Database, a: string, b: string, message: string) {
	const { blocked, blockedBy } = await blockStatus(db, a, b);
	if (blocked || blockedBy) throw new ApiError(403, 'blocked', message);
}

/**
 * Blocks or unblocks in one D1 batch (one transaction). Blocking also removes the follows in both
 * directions (and their notifications) and recomputes both users' follower and following counters
 * from the rows, like unfollow. Idempotent: repeating a block or unblock changes nothing.
 */
export async function setBlocked(
	db: Database,
	blockerId: string,
	blockedId: string,
	block: boolean
): Promise<void> {
	if (!block) {
		await db.delete(userBlock).where(pair(blockerId, blockedId));
		return;
	}
	const follows = (a: string, b: string) =>
		and(eq(userFollow.followerId, a), eq(userFollow.followingId, b));
	const recount = (id: string) =>
		db
			.update(user)
			.set({ followersCount: followersCountOf(id), followingCount: followingCountOf(id) })
			.where(eq(user.id, id));
	await db.batch([
		db.insert(userBlock).values({ blockerId, blockedId }).onConflictDoNothing(),
		db.delete(userFollow).where(or(follows(blockerId, blockedId), follows(blockedId, blockerId))),
		unnotifyStatement(db, { type: 'follow', actorId: blockerId, recipientId: blockedId }),
		unnotifyStatement(db, { type: 'follow', actorId: blockedId, recipientId: blockerId }),
		recount(blockerId),
		recount(blockedId)
	]);
}

export interface BlockedUser {
	id: string;
	name: string;
	handle: string | null;
	image: string | null;
	blockedAt: number;
}

/** Users `blockerId` blocked, most recent first. */
export async function listBlockedUsers(db: Database, blockerId: string): Promise<BlockedUser[]> {
	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			handle: user.handle,
			image: user.image,
			createdAt: userBlock.createdAt
		})
		.from(userBlock)
		.innerJoin(user, eq(user.id, userBlock.blockedId))
		.where(eq(userBlock.blockerId, blockerId))
		.orderBy(desc(userBlock.createdAt), desc(user.id));
	return rows.map(({ createdAt, ...u }) => ({ ...u, blockedAt: createdAt.getTime() }));
}
