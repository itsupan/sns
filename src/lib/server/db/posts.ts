import { asc, inArray, isNull } from 'drizzle-orm';
import type { Database } from '.';
import { post, postMedia } from './schema';

/** Every read or write of a post must exclude soft-deleted rows (see `post.deletedAt`). */
export const notDeleted = isNull(post.deletedAt);

export interface MediaItem {
	url: string;
	type: 'image' | 'video';
}

/** Media for many posts in one query, keyed by post id and ordered by position. */
export async function loadPostMedia(
	db: Database,
	postIds: string[]
): Promise<Map<string, MediaItem[]>> {
	const byPost = new Map<string, MediaItem[]>();
	if (postIds.length === 0) return byPost;

	const rows = await db
		.select({ postId: postMedia.postId, url: postMedia.url, type: postMedia.type })
		.from(postMedia)
		.where(inArray(postMedia.postId, postIds))
		.orderBy(asc(postMedia.postId), asc(postMedia.position));

	for (const { postId, url, type } of rows) {
		const items = byPost.get(postId);
		if (items) items.push({ url, type });
		else byPost.set(postId, [{ url, type }]);
	}
	return byPost;
}
