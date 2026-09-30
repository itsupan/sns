import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { getConfig } from '$lib/server/config';
import { EXPLORE_MAX_PAGES, loadExplorePage } from '$lib/server/db/explore';
import { loadFreshTiles } from '$lib/server/explore';
import { parseQuery, withApi } from '$lib/server/api';

const ExploreQuery = v.object({
	page: v.optional(
		v.pipe(
			v.string(),
			v.toNumber('Page must be a number'),
			v.integer('Page must be a whole number'),
			v.minValue(0, 'Page cannot be negative'),
			v.maxValue(EXPLORE_MAX_PAGES, `Page cannot exceed ${EXPLORE_MAX_PAGES}`)
		),
		'0'
	)
});

/** A page of Explore tiles, ranked for the viewer (works signed out). */
export const GET: RequestHandler = withApi(async ({ url, locals, platform }) => {
	const { page } = await parseQuery(url, ExploreQuery);
	const pageSize = getConfig(platform?.env).explore.defaultPageSize;
	const result = await loadExplorePage(locals.db, locals.user?.id, { page, pageSize });
	return json({
		tiles: await loadFreshTiles(locals.db, result.ids, platform?.env),
		hasMore: result.hasMore
	});
});
