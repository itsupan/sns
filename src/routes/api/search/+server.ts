import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { ApiError, enforceRateLimit, parseQuery, rateLimitSubject, withApi } from '$lib/server/api';
import { getConfig } from '$lib/server/config';
import {
	searchPosts,
	searchUsers,
	toFtsQuery,
	type PostResult,
	type UserResult
} from '$lib/server/db/search';
import { searchTermsOf } from '$lib/search';
import { refreshMediaUrl } from '$lib/server/services/storage';

/**
 * Full-text search over users and live posts, best match first (bm25).
 * Query: `q`, `type` = users | posts | all (default all), `limit` per section.
 * Input that has no searchable term (e.g. under 3 characters) returns empty results, never an error.
 */
export const GET: RequestHandler = withApi(async (event) => {
	const { url, locals, platform } = event;
	const config = getConfig(platform?.env);
	await enforceRateLimit(platform, 'search', rateLimitSubject(event));

	const { maxPageSize, defaultPageSize } = config.search;
	const query = await parseQuery(
		url,
		v.object({
			q: v.optional(v.pipe(v.string(), v.maxLength(200, 'Search is too long')), ''),
			type: v.optional(
				v.picklist(['users', 'posts', 'all'], 'Type must be users, posts or all'),
				'all'
			),
			limit: v.optional(
				v.pipe(
					v.string(),
					v.toNumber('Limit must be a number'),
					v.integer('Limit must be a whole number'),
					v.minValue(1, 'Limit must be at least 1'),
					v.maxValue(maxPageSize, `Limit cannot exceed ${maxPageSize}`)
				),
				String(defaultPageSize)
			)
		})
	);

	const match = toFtsQuery(query.q);
	let users: UserResult[] = [];
	let posts: PostResult[] = [];
	if (match) {
		try {
			[users, posts] = await Promise.all([
				query.type === 'posts' ? [] : searchUsers(locals.db, match, query.limit, locals.user?.id),
				query.type === 'users'
					? []
					: searchPosts(locals.db, match, searchTermsOf(query.q), query.limit, locals.user?.id)
			]);
		} catch (err) {
			// toFtsQuery quotes every term, so this should be unreachable; never let it be a 500.
			if (err instanceof Error && /fts5|MATCH/i.test(`${err.message} ${err.cause}`)) {
				throw new ApiError(400, 'invalid_query', 'That search could not be understood');
			}
			throw err;
		}
	}

	const env = platform?.env;
	const fresh = (u: string | null) => (u ? refreshMediaUrl(u, env) : Promise.resolve(null));
	return json({
		query: query.q,
		users: await Promise.all(users.map(async (u) => ({ ...u, image: await fresh(u.image) }))),
		posts: await Promise.all(
			posts.map(async (p) => ({
				...p,
				thumbnail: p.thumbnail
					? { ...p.thumbnail, url: await refreshMediaUrl(p.thumbnail.url, env) }
					: null,
				author: { ...p.author, image: await fresh(p.author.image) }
			}))
		)
	});
});
