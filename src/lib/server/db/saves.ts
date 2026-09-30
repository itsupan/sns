import { and, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '.';
import { post, postSave, user } from './schema';
import { encodeCursor, notDeleted, type FeedCursor } from './posts';
import { postRowAuthor, toPostCards, type PostRow } from './post-cards';
import type { PostData } from '$lib/components/feed/PostCard.svelte';

/** Saves or unsaves a post. Idempotent: repeating either changes nothing. Saves are private. */
export async function setSaved(
	db: Database,
	userId: string,
	postId: string,
	saved: boolean
): Promise<void> {
	if (saved) {
		await db.insert(postSave).values({ userId, postId }).onConflictDoNothing();
	} else {
		await db.delete(postSave).where(and(eq(postSave.userId, userId), eq(postSave.postId, postId)));
	}
}

/**
 * One page of the user's saved posts, most recently saved first, keyset-paginated on
 * (saved_at, post_id) via `post_save_userId_createdAt_idx`. Deleted posts are skipped.
 * The cursor is `<savedAtMs>_<postId>`.
 */
export async function loadSavedPage(
	db: Database,
	userId: string,
	{ limit, cursor }: { limit: number; cursor?: FeedCursor | null }
): Promise<{ rows: PostRow[]; hasMore: boolean; nextCursor: string | null }> {
	const found = await db
		.select({ post, user: postRowAuthor, savedAt: postSave.createdAt })
		.from(postSave)
		.innerJoin(post, eq(postSave.postId, post.id))
		.innerJoin(user, eq(post.userId, user.id))
		.where(
			and(
				eq(postSave.userId, userId),
				notDeleted,
				cursor
					? sql`(${postSave.createdAt}, ${postSave.postId}) < (${cursor.createdAt}, ${cursor.id})`
					: undefined
			)
		)
		.orderBy(desc(postSave.createdAt), desc(postSave.postId))
		.limit(limit + 1);

	const hasMore = found.length > limit;
	const page = hasMore ? found.slice(0, limit) : found;
	const last = page.at(-1);
	return {
		rows: page.map(({ post, user }) => ({ post, user })),
		hasMore,
		nextCursor: hasMore && last ? encodeCursor({ createdAt: last.savedAt, id: last.post.id }) : null
	};
}

/** Number of saved posts previewed in the profile's Saved tab. */
export const SAVED_PREVIEW_COUNT = 9;

/** The user's most recently saved posts as cards, for the profile's Saved tab. */
export async function loadSavedPreview(db: Database, userId: string): Promise<PostData[]> {
	const page = await loadSavedPage(db, userId, { limit: SAVED_PREVIEW_COUNT });
	return toPostCards(db, page.rows, userId);
}
