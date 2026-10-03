import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from '.';
import { post, postLike, postSave, user } from './schema';
import { loadFollowedIds } from './follows';
import { loadMutedIds } from './mutes';
import {
	loadCommentPreviews,
	loadPostMedia,
	loadPostTags,
	loadRecentLikers,
	notDeleted
} from './posts';
import { visibleTo } from './visibility';
import { displayHandle, formatTimeAgo } from '$lib/utils/format';
import { isTextBackground } from '$lib/post-backgrounds';
import type { PostData, PostType, QuotedPost } from '$lib/components/feed/PostCard.svelte';

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

/**
 * Which of `postIds` the viewer has liked, saved and reposted (three indexed lookups, scoped to
 * the page).
 */
export async function loadViewerPostState(
	db: Database,
	viewerId: string | null | undefined,
	postIds: string[]
): Promise<{ liked: Set<string>; saved: Set<string>; reposted: Set<string> }> {
	if (!viewerId || postIds.length === 0) {
		return { liked: new Set(), saved: new Set(), reposted: new Set() };
	}
	const [likes, saves, reposts] = await Promise.all([
		db
			.select({ postId: postLike.postId })
			.from(postLike)
			.where(and(eq(postLike.userId, viewerId), inArray(postLike.postId, postIds))),
		db
			.select({ postId: postSave.postId })
			.from(postSave)
			.where(and(eq(postSave.userId, viewerId), inArray(postSave.postId, postIds))),
		db
			.select({ postId: post.repostOfId })
			.from(post)
			.where(and(eq(post.userId, viewerId), inArray(post.repostOfId, postIds), notDeleted))
	]);
	return {
		liked: new Set(likes.map((l) => l.postId)),
		saved: new Set(saves.map((s) => s.postId)),
		reposted: new Set(reposts.flatMap((r) => r.postId ?? []))
	};
}

/** The live posts among `ids` the viewer may see, with their authors, in no particular order. */
async function loadVisiblePostRows(
	db: Database,
	viewerId: string | null | undefined,
	ids: string[]
): Promise<PostRow[]> {
	if (ids.length === 0) return [];
	return db
		.select({ post, user: postRowAuthor })
		.from(post)
		.innerJoin(user, eq(post.userId, user.id))
		.where(and(inArray(post.id, ids), notDeleted, visibleTo(viewerId, post.userId)));
}

/** The author block of a card. */
function cardAuthor(r: PostRow) {
	return {
		id: r.user.id,
		name: r.user.name,
		handle: displayHandle(r.user.handle, r.user.name),
		avatar: r.user.image || '',
		timeAgo: formatTimeAgo(r.post.createdAt)
	};
}

/** Quoted posts the viewer may see, as the embeds of quote cards, keyed by post id. */
async function loadQuotedPosts(
	db: Database,
	viewerId: string | null | undefined,
	ids: string[]
): Promise<Map<string, QuotedPost>> {
	const [rows, mediaByPost] = await Promise.all([
		loadVisiblePostRows(db, viewerId, ids),
		loadPostMedia(db, ids)
	]);
	return new Map(
		rows.map((r) => [
			r.post.id,
			{
				id: r.post.id,
				author: cardAuthor(r),
				title: r.post.title || '',
				description: r.post.content,
				mediaItems: mediaByPost.get(r.post.id) ?? [],
				postType: r.post.postType as PostType,
				background: backgroundOf(r.post)
			}
		])
	);
}

/** The text-post background stored on a post row, when it is a valid one. */
export function backgroundOf(row: { postType: string; background: string | null }) {
	return row.postType === 'text' && isTextBackground(row.background) ? row.background : undefined;
}

/**
 * Turns post rows into the `PostCard` shape: media, tags, follow and mute state, the viewer's
 * likes, saves and reposts, the latest comment as a preview and a quote's embedded post. A repost
 * row becomes its original's card naming the reposter, and is dropped when the viewer may no
 * longer see the original. Media URLs are not refreshed here.
 */
export async function toPostCards(
	db: Database,
	rows: PostRow[],
	viewerId: string | null | undefined
): Promise<PostData[]> {
	if (rows.length === 0) return [];
	const repostOfIds = rows.flatMap((r) => r.post.repostOfId ?? []);
	const originals = new Map(
		(await loadVisiblePostRows(db, viewerId, repostOfIds)).map((r) => [r.post.id, r])
	);
	const entries = rows.flatMap((r): { row: PostRow; reposter?: PostRow['user'] }[] => {
		if (!r.post.repostOfId) return [{ row: r }];
		const original = originals.get(r.post.repostOfId);
		return original ? [{ row: original, reposter: r.user }] : [];
	});
	const shown = entries.map((e) => e.row);
	const postIds = shown.map((r) => r.post.id);
	const authorIds = shown.map((r) => r.user.id);
	const quoteOfIds = shown.flatMap((r) => r.post.quoteOfId ?? []);

	const [
		mediaByPost,
		tagsByPost,
		followedAuthors,
		mutedAuthors,
		viewer,
		likers,
		commentPreview,
		quotedById
	] = await Promise.all([
		loadPostMedia(db, postIds),
		loadPostTags(db, postIds),
		loadFollowedIds(db, viewerId, authorIds),
		loadMutedIds(db, viewerId, authorIds),
		loadViewerPostState(db, viewerId, postIds),
		loadRecentLikers(db, viewerId, postIds),
		loadCommentPreviews(db, viewerId, postIds),
		loadQuotedPosts(db, viewerId, quoteOfIds)
	]);

	return entries.map(({ row: r, reposter }) => {
		const media = mediaByPost.get(r.post.id) ?? [];
		const location = r.post.location || r.user.location || undefined;
		return {
			id: r.post.id,
			author: {
				...cardAuthor(r),
				location,
				isFollowing: followedAuthors.has(r.user.id),
				isMuted: mutedAuthors.has(r.user.id)
			},
			repostedBy: reposter && {
				id: reposter.id,
				name: reposter.name,
				handle: displayHandle(reposter.handle, reposter.name)
			},
			quoted: r.post.quoteOfId ? (quotedById.get(r.post.quoteOfId) ?? null) : undefined,
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
			sharesCount: r.post.sharesCount,
			repostsCount: r.post.repostsCount,
			likedBy: likers.get(r.post.id),
			liked: viewer.liked.has(r.post.id),
			saved: viewer.saved.has(r.post.id),
			pinned: r.post.pinnedAt !== null,
			reposted: viewer.reposted.has(r.post.id),
			commentPreview: commentPreview.get(r.post.id)
		};
	});
}
