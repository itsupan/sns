import { asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Database } from '.';
import { post, postMedia, postTag, tag } from './schema';

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
