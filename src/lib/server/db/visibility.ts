import { and, eq, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Database } from '.';
import { post, user } from './schema';
import { notBlockedWith } from './blocks';
import { noMutedKeywordFor, notMutedBy } from './mutes';

/**
 * Condition keeping only rows whose `authorColumn` (a user id) is not a private account hidden
 * from the viewer: public, the viewer themself, or followed by the viewer. Signed out, every
 * private account is hidden. A primary-key lookup per row, so it is cheap on any author column.
 */
export function notPrivateTo(
	viewerId: string | null | undefined,
	authorColumn: SQLiteColumn | SQL
) {
	const hidden = viewerId
		? sql`and private_author.id <> ${viewerId} and not exists (select 1 from user_follow viewer_follow where viewer_follow.follower_id = ${viewerId} and viewer_follow.following_id = private_author.id)`
		: sql``;
	return sql`not exists (select 1 from ${user} private_author where private_author.id = ${authorColumn} and private_author.is_private ${hidden})`;
}

/**
 * Condition for content by `authorColumn` that the viewer may see: not blocked in either
 * direction and not a private account they don't follow. Unlike `notBlockedWith`, it always
 * filters, signed out included.
 */
export function visibleTo(viewerId: string | null | undefined, authorColumn: SQLiteColumn | SQL) {
	return and(notBlockedWith(viewerId, authorColumn), notPrivateTo(viewerId, authorColumn)) as SQL;
}

/**
 * Condition for posts in the viewer's feeds (home, Explore, tag pages): visible to them (see
 * `visibleTo`), not by someone they muted and free of their muted keywords. A repost must also
 * have a live original that passes the same checks. Profiles opened directly filter with
 * `visibleTo` alone, so a mute never hides them.
 */
export function shownInFeedsTo(viewerId: string | null | undefined) {
	const originalAuthor = sql`original.user_id`;
	const originalShown = and(
		visibleTo(viewerId, originalAuthor),
		notMutedBy(viewerId, originalAuthor),
		noMutedKeywordFor(viewerId, sql`original.content`, sql`original.title`)
	);
	return and(
		visibleTo(viewerId, post.userId),
		notMutedBy(viewerId, post.userId),
		noMutedKeywordFor(viewerId),
		sql`(${post.repostOfId} is null or exists (select 1 from ${post} original where original.id = ${post.repostOfId} and original.deleted_at is null and ${originalShown}))`
	) as SQL;
}

/** Whether the viewer may see `profileId`'s posts and follow lists (blocks are checked apart). */
export async function canViewProfile(
	db: Database,
	viewerId: string | null | undefined,
	profileId: string
): Promise<boolean> {
	const rows = await db
		.select({ id: user.id })
		.from(user)
		.where(and(eq(user.id, profileId), notPrivateTo(viewerId, user.id)))
		.limit(1);
	return rows.length > 0;
}
