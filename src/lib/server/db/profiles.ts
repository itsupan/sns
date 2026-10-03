import { stripFormatting } from '$lib/formatting';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '.';
import { post, user } from './schema';
import { followStatus } from './follows';
import { visibleTo } from './visibility';
import { encodeCursor, notDeleted, type FeedCursor } from './posts';
import { postRowAuthor, toPostCards } from './post-cards';
import type { PostData } from '$lib/components/feed/PostCard.svelte';
import type { GridItem } from '$lib/components/profile/ProfileGrid.svelte';
import type { FollowStatus } from '$lib/utils/follow.svelte';

export interface ProfileStats {
	postsCount: number;
	followersCount: number;
	followingCount: number;
	/** Total views across the user's live posts. */
	impressionsCount: number;
	/** Whether `viewerId` follows or asked to follow this user (`none` for anonymous or own profile). */
	followStatus: FollowStatus;
}

export const EMPTY_PROFILE_STATS: ProfileStats = {
	postsCount: 0,
	followersCount: 0,
	followingCount: 0,
	impressionsCount: 0,
	followStatus: 'none'
};

/** Header stats for a profile: live posts and their views, stored follow counters, viewer state. */
export async function loadProfileStats(
	db: Database,
	userId: string,
	viewerId?: string | null
): Promise<ProfileStats> {
	const [[postRow], [userRow], status] = await Promise.all([
		db
			.select({
				postsCount: sql<number>`count(*)`,
				impressionsCount: sql<number>`coalesce(sum(${post.viewsCount}), 0)`
			})
			.from(post)
			.where(and(eq(post.userId, userId), notDeleted)),
		db
			.select({ followersCount: user.followersCount, followingCount: user.followingCount })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1),
		viewerId && viewerId !== userId
			? followStatus(db, viewerId, userId)
			: Promise.resolve<FollowStatus>('none')
	]);

	return {
		postsCount: Number(postRow?.postsCount ?? 0),
		impressionsCount: Number(postRow?.impressionsCount ?? 0),
		followersCount: userRow?.followersCount ?? 0,
		followingCount: userRow?.followingCount ?? 0,
		followStatus: status
	};
}

/**
 * One page of a profile's live posts in the `PostCard` shape, newest first, keyset-paginated on
 * (created_at, id) via `post_userId_createdAt_idx`. Empty when the author and `viewerId` are
 * blocked in either direction, or the author is private and not followed by `viewerId`: that is
 * how the profile page hides them.
 */
export async function loadProfilePosts(
	db: Database,
	userId: string,
	viewerId: string | null | undefined,
	{ limit, cursor }: { limit: number; cursor?: FeedCursor | null }
): Promise<{ posts: PostData[]; nextCursor: string | null }> {
	const rows = await db
		.select({ post, user: postRowAuthor })
		.from(post)
		.innerJoin(user, eq(post.userId, user.id))
		.where(
			and(
				eq(post.userId, userId),
				notDeleted,
				visibleTo(viewerId, post.userId),
				cursor
					? sql`(${post.createdAt}, ${post.id}) < (${cursor.createdAt}, ${cursor.id})`
					: undefined
			)
		)
		.orderBy(desc(post.createdAt), desc(post.id))
		.limit(limit + 1);

	const hasMore = rows.length > limit;
	const page = hasMore ? rows.slice(0, limit) : rows;
	const last = page.at(-1);
	return {
		posts: await toPostCards(db, page, viewerId),
		nextCursor: hasMore && last ? encodeCursor(last.post) : null
	};
}

/** Grid tile for a post; keeps the full post so list view can render a real `PostCard`. */
export function toGridItem(p: PostData): GridItem {
	const first = p.mediaItems?.[0];
	return {
		id: p.id,
		title: p.title || stripFormatting(p.description).slice(0, 40),
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
