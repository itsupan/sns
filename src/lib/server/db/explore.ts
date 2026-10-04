import { stripFormatting } from '$lib/formatting';
import { and, desc, eq, inArray, ne, notExists, notInArray, sql } from 'drizzle-orm';
import type { Database } from '.';
import { post, postTag, tag, user, userFollow } from './schema';
import { encodeCursor, loadPostMedia, notDeleted, notRepost, type FeedCursor } from './posts';
import type { ExploreTile } from '$lib/explore/types';
import { notBlockedWith } from './blocks';
import { shownInFeedsTo } from './visibility';
import { backgroundOf } from './post-cards';

/** Explore ranks only this many of the newest live posts, so each request reads a bounded set. */
export const EXPLORE_CANDIDATES = 500;
/** Explore stops after this many pages; beyond that, the tail is too stale to be worth ranking. */
export const EXPLORE_MAX_PAGES = 10;
/** Trending tags count posts from this window. */
export const TRENDING_WINDOW_MS = 7 * 24 * 3600 * 1000;

const HOUR_MS = 3600 * 1000;

/**
 * Engagement per hour of age: likes count once, comments twice, views a fiftieth; the +2 hours
 * keeps brand-new posts from dominating on their first like.
 */
export function exploreScore(
	p: { likesCount: number; commentsCount: number; viewsCount: number; createdAt: number },
	now: number
): number {
	const engagement = 1 + p.likesCount + 2 * p.commentsCount + p.viewsCount / 50;
	return engagement / ((now - p.createdAt) / HOUR_MS + 2);
}

/** The same score as `exploreScore`, in SQL. */
const scoreSql = (now: number) =>
	sql<number>`(1.0 + ${post.likesCount} + 2.0 * ${post.commentsCount} + ${post.viewsCount} / 50.0) / ((${now} - ${post.createdAt}) / ${sql.raw(`${HOUR_MS}.0`)} + 2.0)`;

/**
 * Posts shown in the viewer's feeds that are not by them or anyone they follow (signed out, every
 * visible post).
 */
function outsideNetwork(db: Database, viewerId: string | null | undefined) {
	if (!viewerId) return shownInFeedsTo(viewerId);
	return and(
		ne(post.userId, viewerId),
		shownInFeedsTo(viewerId),
		notExists(
			db
				.select({ one: sql`1` })
				.from(userFollow)
				.where(and(eq(userFollow.followerId, viewerId), eq(userFollow.followingId, post.userId)))
		)
	);
}

/**
 * One page of Explore: the newest `EXPLORE_CANDIDATES` live posts from outside the viewer's
 * network, ranked by `exploreScore`, ties broken newest first. Offset pages, capped at
 * `EXPLORE_MAX_PAGES` (ranks shift as engagement changes, so a keyset cursor would not hold).
 */
export async function loadExplorePage(
	db: Database,
	viewerId: string | null | undefined,
	{ page, pageSize, now = Date.now() }: { page: number; pageSize: number; now?: number }
): Promise<{ ids: string[]; hasMore: boolean }> {
	if (page >= EXPLORE_MAX_PAGES) return { ids: [], hasMore: false };
	const candidates = db
		.select({ id: post.id })
		.from(post)
		.where(and(notDeleted, notRepost, outsideNetwork(db, viewerId)))
		.orderBy(desc(post.createdAt), desc(post.id))
		.limit(EXPLORE_CANDIDATES);

	const rows = await db
		.select({ id: post.id })
		.from(post)
		.where(inArray(post.id, candidates))
		.orderBy(desc(scoreSql(now)), desc(post.createdAt), desc(post.id))
		.limit(pageSize + 1)
		.offset(page * pageSize);

	const hasMore = rows.length > pageSize && page + 1 < EXPLORE_MAX_PAGES;
	return { ids: rows.slice(0, pageSize).map((r) => r.id), hasMore };
}

/**
 * Live posts tagged `slug` shown in the viewer's feeds (see `shownInFeedsTo`), newest first,
 * keyset-paginated on (created_at, id).
 */
export async function loadTagPage(
	db: Database,
	slug: string,
	{
		limit,
		cursor,
		viewerId
	}: { limit: number; cursor?: FeedCursor | null; viewerId?: string | null }
): Promise<{
	tag: { slug: string; name: string } | null;
	ids: string[];
	nextCursor: string | null;
}> {
	const [found] = await db
		.select({ id: tag.id, slug: tag.slug, name: tag.name })
		.from(tag)
		.where(eq(tag.slug, slug))
		.limit(1);
	if (!found) return { tag: null, ids: [], nextCursor: null };

	const rows = await db
		.select({ id: post.id, createdAt: post.createdAt })
		.from(postTag)
		.innerJoin(post, eq(post.id, postTag.postId))
		.where(
			and(
				eq(postTag.tagId, found.id),
				notDeleted,
				shownInFeedsTo(viewerId),
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
		tag: { slug: found.slug, name: found.name },
		ids: page.map((r) => r.id),
		nextCursor: hasMore && last ? encodeCursor(last) : null
	};
}

/** Tiles for `ids`, in that order (missing or deleted posts are skipped). Media URLs are raw. */
export async function loadTiles(db: Database, ids: string[]): Promise<ExploreTile[]> {
	if (ids.length === 0) return [];
	const [rows, media] = await Promise.all([
		db
			.select({
				id: post.id,
				title: post.title,
				content: post.content,
				likes: post.likesCount,
				comments: post.commentsCount,
				postType: post.postType,
				background: post.background
			})
			.from(post)
			.where(and(inArray(post.id, ids), notDeleted)),
		loadPostMedia(db, ids)
	]);
	const byId = new Map(rows.map((r) => [r.id, r]));
	return ids.flatMap((id) => {
		const r = byId.get(id);
		if (!r) return [];
		const items = media.get(id) ?? [];
		return [
			{
				id,
				title: r.title || stripFormatting(r.content).slice(0, 80),
				cover: items[0] ?? null,
				background: backgroundOf(r),
				isCarousel: items.length > 1,
				likes: r.likes,
				comments: r.comments
			}
		];
	});
}

/** Most-used tags on live posts from the last `TRENDING_WINDOW_MS`. */
export async function loadTrendingTags(
	db: Database,
	{ limit = 10, now = Date.now() }: { limit?: number; now?: number } = {}
): Promise<Array<{ slug: string; name: string; posts: number }>> {
	const posts = sql<number>`count(*)`;
	return db
		.select({ slug: tag.slug, name: tag.name, posts })
		.from(postTag)
		.innerJoin(post, eq(post.id, postTag.postId))
		.innerJoin(tag, eq(tag.id, postTag.tagId))
		.where(and(notDeleted, sql`${post.createdAt} >= ${now - TRENDING_WINDOW_MS}`))
		.groupBy(tag.id)
		.orderBy(desc(posts), tag.slug)
		.limit(limit);
}

export interface CreatorRow {
	id: string;
	name: string;
	handle: string | null;
	image: string | null;
	followersCount: number;
	/** People the viewer follows who follow this creator. */
	mutuals: number;
}

/**
 * Creators to follow: people followed by people the viewer follows, most shared first, topped up
 * with the most-followed creators. Never the viewer, anyone they already follow or anyone blocked
 * in either direction.
 */
export async function loadSuggestedCreators(
	db: Database,
	viewerId: string | null | undefined,
	limit = 6
): Promise<CreatorRow[]> {
	const cols = {
		id: user.id,
		name: user.name,
		handle: user.handle,
		image: user.image,
		followersCount: user.followersCount
	};
	const notMeOrFollowed = viewerId
		? and(
				ne(user.id, viewerId),
				notBlockedWith(viewerId, user.id),
				notExists(
					db
						.select({ one: sql`1` })
						.from(userFollow)
						.where(and(eq(userFollow.followerId, viewerId), eq(userFollow.followingId, user.id)))
				)
			)
		: undefined;

	let viaFriends: CreatorRow[] = [];
	if (viewerId) {
		const friends = db
			.select({ id: userFollow.followingId })
			.from(userFollow)
			.where(eq(userFollow.followerId, viewerId));
		const mutuals = sql<number>`count(*)`;
		viaFriends = await db
			.select({ ...cols, mutuals })
			.from(userFollow)
			.innerJoin(user, eq(user.id, userFollow.followingId))
			.where(and(inArray(userFollow.followerId, friends), notMeOrFollowed))
			.groupBy(user.id)
			.orderBy(desc(mutuals), desc(user.followersCount), user.id)
			.limit(limit);
	}
	if (viaFriends.length >= limit) return viaFriends;

	const taken = viaFriends.map((u) => u.id);
	const popular = await db
		.select(cols)
		.from(user)
		.where(and(notMeOrFollowed, taken.length ? notInArray(user.id, taken) : undefined))
		.orderBy(desc(user.followersCount), user.id)
		.limit(limit - viaFriends.length);
	return [...viaFriends, ...popular.map((u) => ({ ...u, mutuals: 0 }))];
}
