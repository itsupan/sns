import { stripFormatting } from '$lib/formatting';
import { and, asc, desc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import type { Database } from '.';
import { post, postMedia, user, userFollow } from './schema';
import { notDeleted } from './posts';
import { displayHandle } from '$lib/utils/format';
import { searchTermsOf } from '$lib/search';
import { notBlockedWith } from './blocks';
import { visibleTo } from './visibility';

/**
 * Turns user input into a safe FTS5 MATCH expression, or `null` when nothing is searchable.
 * Each term (see `searchTermsOf`) becomes a quoted string with embedded quotes doubled, so
 * FTS5 syntax in the input (`OR`, `NEAR`, `*`, `^`, `:`, parentheses) is matched literally and
 * can never raise a syntax error. Terms are ANDed; with the trigram tokenizer each one
 * matches as a substring, which covers prefix search in every script.
 */
export function toFtsQuery(raw: string): string | null {
	const terms = searchTermsOf(raw);
	return terms.length ? terms.map((t) => `"${t.replaceAll('"', '""')}"`).join(' ') : null;
}

/** ~`width` characters of `text` around the first match of any term, with ellipses. */
export function snippetAround(text: string, terms: string[], width = 120): string {
	const clean = stripFormatting(text).replace(/\s+/g, ' ').trim();
	if (clean.length <= width) return clean;
	const lower = clean.toLowerCase();
	const hits = terms.map((t) => lower.indexOf(t.toLowerCase())).filter((i) => i >= 0);
	const hit = hits.length ? Math.min(...hits) : 0;
	const start = Math.max(0, Math.min(hit - Math.floor(width / 3), clean.length - width));
	const end = Math.min(clean.length, start + width);
	return `${start > 0 ? '…' : ''}${clean.slice(start, end).trim()}${end < clean.length ? '…' : ''}`;
}

export interface UserResult {
	id: string;
	name: string;
	handle: string;
	/** Profile path segment: the handle when set, otherwise the id. */
	slug: string;
	image: string | null;
	bio: string | null;
	followersCount: number;
}

export interface PostResult {
	id: string;
	snippet: string;
	location: string | null;
	thumbnail: { url: string; type: 'image' | 'video' } | null;
	createdAt: Date;
	author: { id: string; name: string; handle: string; image: string | null };
}

/**
 * Users ranked by bm25; a handle hit weighs most, then name, then bio. Users blocked in either
 * direction with `viewerId` are left out.
 */
export async function searchUsers(
	db: Database,
	match: string,
	limit: number,
	viewerId?: string | null
): Promise<UserResult[]> {
	const rank = sql<number>`bm25(user_fts, 3.0, 5.0, 1.0)`;
	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			handle: user.handle,
			image: user.image,
			bio: user.bio,
			followersCount: user.followersCount
		})
		.from(sql`user_fts`)
		.innerJoin(user, sql`${user}.rowid = user_fts.rowid`)
		.where(and(sql`user_fts MATCH ${match}`, notBlockedWith(viewerId, user.id)))
		.orderBy(rank, asc(user.id))
		.limit(limit);

	return rows.map((r) => ({
		...r,
		handle: displayHandle(r.handle, r.name),
		slug: r.handle ? r.handle.replace(/^@/, '') : r.id
	}));
}

/**
 * Live (not soft-deleted) posts ranked by bm25; a content hit weighs more than location. Posts by
 * users blocked in either direction with `viewerId` are left out.
 */
export async function searchPosts(
	db: Database,
	match: string,
	terms: string[],
	limit: number,
	viewerId?: string | null
): Promise<PostResult[]> {
	const rank = sql<number>`bm25(post_fts, 2.0, 1.0)`;
	const rows = await db
		.select({
			id: post.id,
			content: post.content,
			location: post.location,
			createdAt: post.createdAt,
			author: { id: user.id, name: user.name, handle: user.handle, image: user.image }
		})
		.from(sql`post_fts`)
		.innerJoin(post, sql`${post}.rowid = post_fts.rowid`)
		.innerJoin(user, eq(user.id, post.userId))
		.where(and(sql`post_fts MATCH ${match}`, notDeleted, visibleTo(viewerId, post.userId)))
		.orderBy(rank, asc(post.id))
		.limit(limit);

	const thumbs = new Map<string, PostResult['thumbnail']>();
	if (rows.length > 0) {
		const media = await db
			.select({ postId: postMedia.postId, url: postMedia.url, type: postMedia.type })
			.from(postMedia)
			.where(
				and(
					inArray(
						postMedia.postId,
						rows.map((r) => r.id)
					),
					eq(postMedia.position, 0)
				)
			);
		for (const m of media) thumbs.set(m.postId, { url: m.url, type: m.type });
	}

	return rows.map((r) => ({
		id: r.id,
		snippet: snippetAround(r.content, terms),
		location: r.location,
		thumbnail: thumbs.get(r.id) ?? null,
		createdAt: r.createdAt,
		author: { ...r.author, handle: displayHandle(r.author.handle, r.author.name) }
	}));
}

export interface MentionSuggestion {
	id: string;
	name: string;
	/** Bare handle (no `@`), as it is typed after `@`. */
	handle: string;
	image: string | null;
}

/**
 * People to tag whose handle starts with `prefix` (lowercase, may be empty): those the viewer
 * follows first, then the most followed. The handle range keeps it on the unique handle index.
 */
export async function suggestMentions(
	db: Database,
	viewerId: string,
	prefix: string,
	limit: number
): Promise<MentionSuggestion[]> {
	const follows = sql<number>`exists (select 1 from ${userFollow} where ${userFollow.followerId} = ${viewerId} and ${userFollow.followingId} = ${user.id})`;
	const rows = await db
		.select({ id: user.id, name: user.name, handle: user.handle, image: user.image })
		.from(user)
		.where(
			and(
				isNotNull(user.handle),
				prefix
					? sql`${user.handle} >= ${prefix} and ${user.handle} < ${`${prefix}\uffff`}`
					: undefined,
				ne(user.id, viewerId),
				notBlockedWith(viewerId, user.id)
			)
		)
		.orderBy(desc(follows), desc(user.followersCount), asc(user.handle))
		.limit(limit);
	return rows.map((r) => ({ ...r, handle: r.handle ?? '' }));
}
