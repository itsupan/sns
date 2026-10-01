import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { enforceRateLimit, parseQuery, requireUser, withApi } from '$lib/server/api';
import { suggestMentions } from '$lib/server/db/search';
import { refreshMediaUrl } from '$lib/server/services/storage';

const SUGGESTION_LIMIT = 6;

/**
 * People to @mention while writing a post. Query: `q`, the handle typed so far (a leading `@` is
 * ignored). Anything that cannot start a handle returns no one.
 */
export const GET: RequestHandler = withApi(async ({ url, locals, platform }) => {
	const viewer = requireUser(locals);
	await enforceRateLimit(platform, 'search', viewer.id);
	const { q } = await parseQuery(
		url,
		v.object({ q: v.optional(v.pipe(v.string(), v.maxLength(31)), '') })
	);
	const prefix = q.replace(/^@/, '').toLowerCase();
	if (!/^[a-z0-9_.-]{0,30}$/.test(prefix)) return json({ users: [] });

	const users = await suggestMentions(locals.db, viewer.id, prefix, SUGGESTION_LIMIT);
	return json({
		users: await Promise.all(
			users.map(async (u) => ({
				...u,
				image: u.image ? await refreshMediaUrl(u.image, platform?.env) : null
			}))
		)
	});
});
