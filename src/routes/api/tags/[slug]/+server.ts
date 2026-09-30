import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConfig } from '$lib/server/config';
import { loadTagPage } from '$lib/server/db/explore';
import { loadFreshTiles } from '$lib/server/explore';
import { ApiError, parsePageQuery, withApi } from '$lib/server/api';

/** Posts tagged `:slug`, newest first. */
export const GET: RequestHandler = withApi(async ({ params, url, locals, platform }) => {
	const page = await parsePageQuery(url, getConfig(platform?.env).explore);
	const result = await loadTagPage(locals.db, params.slug.toLowerCase(), {
		...page,
		viewerId: locals.user?.id
	});
	if (!result.tag) throw new ApiError(404, 'not_found', 'Tag not found');
	return json({
		tag: result.tag,
		tiles: await loadFreshTiles(locals.db, result.ids, platform?.env),
		nextCursor: result.nextCursor
	});
});
