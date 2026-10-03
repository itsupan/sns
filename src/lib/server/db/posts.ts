import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { Database } from '.';
import { post, postComment, postLike, postMedia, postTag, tag, user } from './schema';
import { MAX_TAGS_PER_POST } from '$lib/constants/post-limits';
import { notBlockedWith } from './blocks';
import { notMutedBy } from './mutes';
import { notPrivateTo, shownInFeedsTo } from './visibility';
import { ApiError } from '$lib/server/api/errors';

/** Every read or write of a post must exclude soft-deleted rows (see `post.deletedAt`). */
export const notDeleted = isNull(post.deletedAt);

/**
 * The live post `postId` with its author, or a 404 when it is missing, deleted, or by a private
 * account the viewer does not follow. Blocks are left to `requireNotBlocked`, which answers 403.
 */
export async function requireVisiblePost(
	db: Database,
	viewerId: string | null | undefined,
	postId: string
) {
	const [row] = await db
		.select({ id: post.id, authorId: post.userId, sharesCount: post.sharesCount })
		.from(post)
		.where(and(eq(post.id, postId), notDeleted, notPrivateTo(viewerId, post.userId)))
		.limit(1);
	if (!row) throw new ApiError(404, 'not_found', 'Post not found');
	return row;
}

/** Position in the feed: the last post seen, ordered by (created_at, id) descending. */
export interface FeedCursor {
	createdAt: number;
	id: string;
}

/** Opaque-ish cursor `<createdAtMs>_<postId>` (post ids may contain '_', so split on the first). */
export function encodeCursor({ createdAt, id }: { createdAt: Date; id: string }): string {
	return `${createdAt.getTime()}_${id}`;
}

export function decodeCursor(raw: string): FeedCursor | null {
	const match = /^(\d{1,16})_(.+)$/.exec(raw);
	if (!match) return null;
	const createdAt = Number(match[1]);
	return Number.isSafeInteger(createdAt) ? { createdAt, id: match[2] } : null;
}

/**
 * One feed page, newest first, using keyset pagination on (created_at, id) served by
 * `post_createdAt_id_idx`, so posts added while scrolling never shift later pages.
 * Fetches one extra row to know whether another page exists. Posts kept out of `viewerId`'s feeds
 * (see `shownInFeedsTo`) are left out.
 */
export async function loadFeedPage(
	db: Database,
	{
		limit,
		cursor,
		viewerId
	}: { limit: number; cursor?: FeedCursor | null; viewerId?: string | null }
) {
	const rows = await db
		.select({
			post: post,
			user: {
				id: user.id,
				name: user.name,
				handle: user.handle,
				image: user.image,
				location: user.location
			}
		})
		.from(post)
		.innerJoin(user, eq(post.userId, user.id))
		.where(
			and(
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
		rows: page,
		hasMore,
		nextCursor: hasMore && last ? encodeCursor(last.post) : null
	};
}

export interface MediaItem {
	url: string;
	type: 'image' | 'video';
	/** Author-written description for screen readers. */
	alt?: string;
}

/** Media for many posts in one query, keyed by post id and ordered by position. */
export async function loadPostMedia(
	db: Database,
	postIds: string[]
): Promise<Map<string, MediaItem[]>> {
	const byPost = new Map<string, MediaItem[]>();
	if (postIds.length === 0) return byPost;

	const rows = await db
		.select({
			postId: postMedia.postId,
			url: postMedia.url,
			type: postMedia.type,
			alt: postMedia.alt
		})
		.from(postMedia)
		.where(inArray(postMedia.postId, postIds))
		.orderBy(asc(postMedia.postId), asc(postMedia.position));

	for (const { postId, url, type, alt } of rows) {
		const item: MediaItem = { url, type, alt: alt ?? undefined };
		const items = byPost.get(postId);
		if (items) items.push(item);
		else byPost.set(postId, [item]);
	}
	return byPost;
}

const VIDEO_URL = /\.(mp4|webm|mov)(\?.*)?$/i;

/**
 * Cleans a `mediaUrls` payload (`[{ url, type?, alt? }]`) from the composer: drops blank entries,
 * infers video from the declared type or the file extension and trims alt text, dropping it when
 * blank. Order is kept (first = cover).
 */
export function normalizeMedia(input: unknown): MediaItem[] {
	if (!Array.isArray(input)) return [];
	return input
		.filter(
			(m): m is { url: string; type?: string; alt?: unknown } =>
				typeof m === 'object' && m !== null && typeof m.url === 'string' && m.url.trim().length > 0
		)
		.map((m) => ({
			url: m.url.trim(),
			type: m.type === 'video' || VIDEO_URL.test(m.url) ? 'video' : 'image',
			alt: (typeof m.alt === 'string' && m.alt.trim()) || undefined
		}));
}

export interface NormalizedTag {
	/** Lowercase, no '#'. Unique key in `tag`. */
	slug: string;
	/** Display form, no '#'. */
	name: string;
}

/**
 * Cleans author-supplied tags: trims, strips leading '#', drops blanks and case-insensitive
 * duplicates (first spelling wins), keeping the author's order. Same rules as migration 0007.
 */
export function normalizeTags(input: unknown): NormalizedTag[] {
	if (!Array.isArray(input)) return [];
	const seen = new Set<string>();
	const tags: NormalizedTag[] = [];
	for (const raw of input) {
		if (typeof raw !== 'string') continue;
		const name = raw.trim().replace(/^#+/, '').trim();
		const slug = name.toLowerCase();
		if (!slug || seen.has(slug)) continue;
		seen.add(slug);
		tags.push({ slug, name });
	}
	return tags;
}

/** Tags for many posts in one query, keyed by post id, as `#Name` in the author's order. */
export async function loadPostTags(
	db: Database,
	postIds: string[]
): Promise<Map<string, string[]>> {
	const byPost = new Map<string, string[]>();
	if (postIds.length === 0) return byPost;

	const rows = await db
		.select({ postId: postTag.postId, name: tag.name })
		.from(postTag)
		.innerJoin(tag, eq(postTag.tagId, tag.id))
		.where(inArray(postTag.postId, postIds))
		.orderBy(asc(postTag.postId), asc(postTag.position));

	for (const { postId, name } of rows) {
		const items = byPost.get(postId);
		if (items) items.push(`#${name}`);
		else byPost.set(postId, [`#${name}`]);
	}
	return byPost;
}

/**
 * Batch statements that attach `tags` to `postId`: create missing tags (existing slugs keep
 * their original display name), then link them in the given order. Run inside the same
 * `db.batch` as the post insert so the post and its tags land atomically.
 */
export function attachTagsStatements(db: Database, postId: string, tags: NormalizedTag[]) {
	if (tags.length === 0) return [];
	// Callers validate first; this guards D1's 100-variable limit if a new caller forgets.
	if (tags.length > MAX_TAGS_PER_POST) {
		throw new Error(`attachTagsStatements: ${tags.length} tags exceeds ${MAX_TAGS_PER_POST}`);
	}

	const positionBySlug = sql.join(
		tags.map((t, i) => sql`when ${t.slug} then ${i}`),
		sql` `
	);

	return [
		db
			.insert(tag)
			.values(tags.map((t) => ({ id: crypto.randomUUID(), slug: t.slug, name: t.name })))
			.onConflictDoNothing({ target: tag.slug }),
		db.insert(postTag).select(
			db
				.select({
					postId: sql<string>`${postId}`.as('post_id'),
					tagId: tag.id,
					position: sql<number>`case ${tag.slug} ${positionBySlug} end`.as('position')
				})
				.from(tag)
				.where(
					inArray(
						tag.slug,
						tags.map((t) => t.slug)
					)
				)
		)
	] as const;
}

/**
 * Each post's most recent liker other than the viewer (and not blocked with them), by name, for
 * the "Liked by" line under a post.
 */
export async function loadRecentLikers(
	db: Database,
	viewerId: string | null | undefined,
	postIds: string[]
): Promise<Map<string, string>> {
	if (postIds.length === 0) return new Map();
	const ranked = db
		.select({
			postId: postLike.postId,
			name: user.name,
			rank: sql<number>`row_number() over (partition by ${postLike.postId} order by ${postLike.createdAt} desc)`.as(
				'rank'
			)
		})
		.from(postLike)
		.innerJoin(user, eq(user.id, postLike.userId))
		.where(
			and(
				inArray(postLike.postId, postIds),
				viewerId ? ne(postLike.userId, viewerId) : undefined,
				notBlockedWith(viewerId, postLike.userId)
			)
		)
		.as('ranked');
	const rows = await db
		.select({ postId: ranked.postId, name: ranked.name })
		.from(ranked)
		.where(eq(ranked.rank, 1));
	return new Map(rows.map((r) => [r.postId, r.name]));
}

/** Each post's newest top-level comment the viewer may see, as the card's preview line. */
export async function loadCommentPreviews(
	db: Database,
	viewerId: string | null | undefined,
	postIds: string[]
): Promise<Map<string, { author: string; content: string }>> {
	if (postIds.length === 0) return new Map();
	const ranked = db
		.select({
			postId: postComment.postId,
			content: postComment.content,
			authorName: user.name,
			authorHandle: user.handle,
			rank: sql<number>`row_number() over (partition by ${postComment.postId} order by ${postComment.createdAt} desc, ${postComment.id} desc)`.as(
				'rank'
			)
		})
		.from(postComment)
		.innerJoin(user, eq(postComment.userId, user.id))
		.where(
			and(
				inArray(postComment.postId, postIds),
				isNull(postComment.parentCommentId),
				notBlockedWith(viewerId, postComment.userId),
				notMutedBy(viewerId, postComment.userId)
			)
		)
		.as('ranked');
	const rows = await db.select().from(ranked).where(eq(ranked.rank, 1));
	return new Map(
		rows.map((c) => [
			c.postId,
			{ author: c.authorHandle ? `@${c.authorHandle}` : c.authorName, content: c.content }
		])
	);
}
