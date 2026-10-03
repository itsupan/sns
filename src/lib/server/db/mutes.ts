import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Database } from '.';
import { mutedKeyword, post, user, userMute } from './schema';
import { MAX_MUTED_KEYWORDS } from '$lib/constants/mute-limits';
import { ApiError } from '$lib/server/api/errors';

const pair = (muterId: string, mutedId: string) =>
	and(eq(userMute.muterId, muterId), eq(userMute.mutedId, mutedId));

const ownKeyword = (userId: string, keyword: string) =>
	and(eq(mutedKeyword.userId, userId), eq(mutedKeyword.keyword, keyword));

/**
 * Condition keeping only rows whose `column` (a user id) the viewer has not muted. `undefined`
 * (no filter) when signed out, so it can go straight into `and(...)`.
 */
export function notMutedBy(
	viewerId: string | null | undefined,
	column: SQLiteColumn | SQL
): SQL | undefined {
	return viewerId
		? sql`not exists (select 1 from ${userMute} where ${userMute.muterId} = ${viewerId} and ${userMute.mutedId} = ${column})`
		: undefined;
}

/**
 * Condition keeping only posts whose text and title contain none of the viewer's muted keywords
 * (stored lowercased, so the match is case-insensitive). `undefined` when signed out.
 */
export function noMutedKeywordFor(viewerId: string | null | undefined): SQL | undefined {
	return viewerId
		? sql`not exists (select 1 from ${mutedKeyword} where ${mutedKeyword.userId} = ${viewerId} and instr(lower(${post.content} || ' ' || coalesce(${post.title}, '')), ${mutedKeyword.keyword}) > 0)`
		: undefined;
}

/** Which of `userIds` the viewer muted (one indexed lookup, scoped to the page). */
export async function loadMutedIds(
	db: Database,
	viewerId: string | null | undefined,
	userIds: string[]
): Promise<Set<string>> {
	const ids = [...new Set(userIds)].filter((id) => id !== viewerId);
	if (!viewerId || ids.length === 0) return new Set();
	const rows = await db
		.select({ id: userMute.mutedId })
		.from(userMute)
		.where(and(eq(userMute.muterId, viewerId), inArray(userMute.mutedId, ids)));
	return new Set(rows.map((r) => r.id));
}

/** Mutes or unmutes. Idempotent: repeating either changes nothing. */
export async function setMuted(
	db: Database,
	muterId: string,
	mutedId: string,
	mute: boolean
): Promise<void> {
	if (mute) await db.insert(userMute).values({ muterId, mutedId }).onConflictDoNothing();
	else await db.delete(userMute).where(pair(muterId, mutedId));
}

export interface MutedUser {
	id: string;
	name: string;
	handle: string | null;
	image: string | null;
	mutedAt: number;
}

/** Users `muterId` muted, most recent first. */
export async function listMutedUsers(db: Database, muterId: string): Promise<MutedUser[]> {
	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			handle: user.handle,
			image: user.image,
			createdAt: userMute.createdAt
		})
		.from(userMute)
		.innerJoin(user, eq(user.id, userMute.mutedId))
		.where(eq(userMute.muterId, muterId))
		.orderBy(desc(userMute.createdAt), desc(user.id));
	return rows.map(({ createdAt, ...u }) => ({ ...u, mutedAt: createdAt.getTime() }));
}

/** `userId`'s muted keywords, most recent first. */
export async function listMutedKeywords(db: Database, userId: string): Promise<string[]> {
	const rows = await db
		.select({ keyword: mutedKeyword.keyword })
		.from(mutedKeyword)
		.where(eq(mutedKeyword.userId, userId))
		.orderBy(desc(mutedKeyword.createdAt), mutedKeyword.keyword);
	return rows.map((r) => r.keyword);
}

/**
 * Mutes `keyword` (already trimmed and lowercased) for `userId`. Idempotent. The cap is checked
 * by the insert itself, so concurrent adds cannot pass `MAX_MUTED_KEYWORDS`; a 400 when full.
 */
export async function addMutedKeyword(db: Database, userId: string, keyword: string) {
	const inserted = await db.all(
		sql`insert into ${mutedKeyword} (user_id, keyword) select ${userId}, ${keyword} where (select count(*) from ${mutedKeyword} where user_id = ${userId}) < ${MAX_MUTED_KEYWORDS} on conflict do nothing returning keyword`
	);
	if (inserted.length > 0) return;
	const existing = await db
		.select({ keyword: mutedKeyword.keyword })
		.from(mutedKeyword)
		.where(ownKeyword(userId, keyword))
		.limit(1);
	if (existing.length > 0) return;
	throw new ApiError(
		400,
		'validation_failed',
		`You can mute at most ${MAX_MUTED_KEYWORDS} keywords`
	);
}

/** Unmutes `keyword` for `userId`. Idempotent. */
export async function removeMutedKeyword(db: Database, userId: string, keyword: string) {
	await db.delete(mutedKeyword).where(ownKeyword(userId, keyword));
}
