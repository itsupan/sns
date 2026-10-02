import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from '.';
import { post, postLike, postSave, user } from './schema';
import { loadFollowedIds } from './follows';
import { loadCommentPreviews, loadPostMedia, loadPostTags, loadRecentLikers } from './posts';
import { displayHandle, formatTimeAgo } from '$lib/utils/format';
import { isTextBackground } from '$lib/post-backgrounds';
import type { PostData, PostType } from '$lib/components/feed/PostCard.svelte';

/** A post joined with its author, as the feed, saved and explore queries select it. */
export interface PostRow {
	post: typeof post.$inferSelect;
	user: {
		id: string;
		name: string;
		handle: string | null;
		image: string | null;
		location: string | null;
	};
}

/** The author columns every `PostRow` query selects. */
export const postRowAuthor = {
	id: user.id,
	name: user.name,
	handle: user.handle,
	image: user.image,
	location: user.location
};

/** Which of `postIds` the viewer has liked and saved (two indexed lookups, scoped to the page). */
export async function loadViewerPostState(
	db: Database,
	viewerId: string | null | undefined,
	postIds: string[]
): Promise<{ liked: Set<string>; saved: Set<string> }> {
	if (!viewerId || postIds.length === 0) return { liked: new Set(), saved: new Set() };
	const [likes, saves] = await Promise.all([
		db
			.select({ postId: postLike.postId })
			.from(postLike)
			.where(and(eq(postLike.userId, viewerId), inArray(postLike.postId, postIds))),
		db
			.select({ postId: postSave.postId })
			.from(postSave)
			.where(and(eq(postSave.userId, viewerId), inArray(postSave.postId, postIds)))
	]);
	return {
		liked: new Set(likes.map((l) => l.postId)),
		saved: new Set(saves.map((s) => s.postId))
	};
}

/** The text-post background stored on a post row, when it is a valid one. */
export function backgroundOf(row: { postType: string; background: string | null }) {
	return row.postType === 'text' && isTextBackground(row.background) ? row.background : undefined;
}

/**
 * Turns post rows into the `PostCard` shape: media, tags, follow state, the viewer's likes and
 * saves, and the latest comment as a preview. Media URLs are not refreshed here.
 */
export async function toPostCards(
	db: Database,
	rows: PostRow[],
	viewerId: string | null | undefined
): Promise<PostData[]> {
	if (rows.length === 0) return [];
	const postIds = rows.map((r) => r.post.id);

	const [mediaByPost, tagsByPost, followedAuthors, viewer, likers, commentPreview] =
		await Promise.all([
			loadPostMedia(db, postIds),
			loadPostTags(db, postIds),
			loadFollowedIds(
				db,
				viewerId,
				rows.map((r) => r.user.id)
			),
			loadViewerPostState(db, viewerId, postIds),
			loadRecentLikers(db, viewerId, postIds),
			loadCommentPreviews(db, viewerId, postIds)
		]);

	return rows.map((r) => {
		const media = mediaByPost.get(r.post.id) ?? [];
		const location = r.post.location || r.user.location || undefined;
		return {
			id: r.post.id,
			author: {
				id: r.user.id,
				name: r.user.name,
				handle: displayHandle(r.user.handle, r.user.name),
				avatar: r.user.image || '',
				location,
				timeAgo: formatTimeAgo(r.post.createdAt),
				isFollowing: followedAuthors.has(r.user.id)
			},
			title: r.post.title || '',
			description: r.post.content,
			image: media[0]?.url || '',
			mediaUrl: media[0]?.url || undefined,
			mediaType: media[0]?.type || 'none',
			mediaItems: media,
			aspectRatio: (r.post.aspectRatio as '1:1' | '4:5' | '16:9') || '1:1',
			postType: r.post.postType as PostType,
			background: backgroundOf(r.post),
			location,
			cameraMeta: r.post.cameraMeta || undefined,
			tags: tagsByPost.get(r.post.id) ?? [],
			likes: r.post.likesCount,
			commentsCount: r.post.commentsCount,
			repostsCount: r.post.sharesCount,
			likedBy: likers.get(r.post.id),
			liked: viewer.liked.has(r.post.id),
			saved: viewer.saved.has(r.post.id),
			commentPreview: commentPreview.get(r.post.id)
		};
	});
}
