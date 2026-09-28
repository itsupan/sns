import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '.';
import { post, postLike, userFollow } from './schema';
import { loadPostMedia, loadPostTags, notDeleted } from './posts';
import { formatTimeAgo } from '$lib/utils/format';
import type { PostData } from '$lib/components/feed/PostCard.svelte';
import type { GridItem } from '$lib/components/profile/ProfileGrid.svelte';

export interface ProfileStats {
	postsCount: number;
	followersCount: number;
	followingCount: number;
	/** Total views across the user's live posts. */
	impressionsCount: number;
	/** Whether `viewerId` follows this user (always false for anonymous or own profile). */
	isFollowing: boolean;
}

export const EMPTY_PROFILE_STATS: ProfileStats = {
	postsCount: 0,
	followersCount: 0,
	followingCount: 0,
	impressionsCount: 0,
	isFollowing: false
};

const followersOf = (userId: string) =>
	sql<number>`(select count(*) from ${userFollow} where ${userFollow.followingId} = ${userId})`;

const followingOf = (userId: string) =>
	sql<number>`(select count(*) from ${userFollow} where ${userFollow.followerId} = ${userId})`;

/** Header stats for a profile in one round trip. */
export async function loadProfileStats(
	db: Database,
	userId: string,
	viewerId?: string | null
): Promise<ProfileStats> {
	const isFollowingSql =
		viewerId && viewerId !== userId
			? sql<number>`exists(select 1 from ${userFollow} where ${userFollow.followerId} = ${viewerId} and ${userFollow.followingId} = ${userId})`
			: sql<number>`0`;

	const [row] = await db
		.select({
			postsCount: sql<number>`count(*)`,
			impressionsCount: sql<number>`coalesce(sum(${post.viewsCount}), 0)`,
			followersCount: followersOf(userId),
			followingCount: followingOf(userId),
			isFollowing: isFollowingSql
		})
		.from(post)
		.where(and(eq(post.userId, userId), notDeleted));

	return {
		postsCount: Number(row?.postsCount ?? 0),
		impressionsCount: Number(row?.impressionsCount ?? 0),
		followersCount: Number(row?.followersCount ?? 0),
		followingCount: Number(row?.followingCount ?? 0),
		isFollowing: Boolean(row?.isFollowing)
	};
}

export interface ProfileAuthor {
	id: string;
	name: string;
	handle: string | null;
	image: string | null;
	location: string | null;
}

/** A profile's live posts, newest first, in the same shape the feed renders with `PostCard`. */
export async function loadProfilePosts(
	db: Database,
	author: ProfileAuthor,
	viewerId?: string | null
): Promise<PostData[]> {
	const postRows = await db
		.select()
		.from(post)
		.where(and(eq(post.userId, author.id), notDeleted))
		.orderBy(desc(post.createdAt));
	if (postRows.length === 0) return [];

	const postIds = postRows.map((p) => p.id);
	const [mediaByPost, tagsByPost, likedRows] = await Promise.all([
		loadPostMedia(db, postIds),
		loadPostTags(db, postIds),
		viewerId
			? db
					.select({ postId: postLike.postId })
					.from(postLike)
					.where(and(eq(postLike.userId, viewerId), inArray(postLike.postId, postIds)))
			: Promise.resolve([])
	]);
	const liked = new Set(likedRows.map((l) => l.postId));
	const handle = author.handle
		? `@${author.handle.replace(/^@/, '')}`
		: `@${author.name.toLowerCase().replace(/\s+/g, '')}`;

	return postRows.map((p) => {
		const media = mediaByPost.get(p.id) ?? [];
		const location = p.location || author.location || undefined;
		return {
			id: p.id,
			author: {
				id: author.id,
				name: author.name,
				handle,
				avatar: author.image || '',
				location,
				timeAgo: formatTimeAgo(p.createdAt)
			},
			title: p.title || '',
			description: p.content,
			image: media[0]?.url || '',
			mediaUrl: media[0]?.url || undefined,
			mediaType: media[0]?.type || 'none',
			mediaItems: media,
			aspectRatio: (p.aspectRatio as '1:1' | '4:5' | '16:9') || '1:1',
			postType: p.postType as 'photo' | 'story' | 'article',
			location,
			cameraMeta: p.cameraMeta || undefined,
			tags: tagsByPost.get(p.id) ?? [],
			likes: p.likesCount,
			commentsCount: p.commentsCount,
			repostsCount: p.sharesCount,
			liked: liked.has(p.id)
		};
	});
}

/** Grid tile for a post; keeps the full post so list view can render a real `PostCard`. */
export function toGridItem(p: PostData): GridItem {
	const first = p.mediaItems?.[0];
	return {
		id: p.id,
		title: p.title || p.description.slice(0, 40),
		image: first?.url || p.image,
		mediaType: first?.type ?? 'none',
		likes: p.likes,
		comments: p.commentsCount,
		isCarousel: (p.mediaItems?.length ?? 0) > 1,
		cameraMeta: p.cameraMeta,
		description: p.description,
		tags: p.tags,
		date: p.author.timeAgo,
		location: p.location,
		post: p
	};
}
