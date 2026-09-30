import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getConfig } from '$lib/server/config';
import { loadTagPage } from '$lib/server/db/explore';
import { loadFreshTiles } from '$lib/server/explore';

export const load: PageServerLoad = async ({ locals, platform, params }) => {
	const result = await loadTagPage(locals.db, params.tag.toLowerCase(), {
		limit: getConfig(platform?.env).explore.defaultPageSize,
		viewerId: locals.user?.id
	});
	if (!result.tag) throw error(404, 'Tag not found');
	return {
		tag: result.tag,
		tiles: await loadFreshTiles(locals.db, result.ids, platform?.env),
		nextCursor: result.nextCursor
	};
};
