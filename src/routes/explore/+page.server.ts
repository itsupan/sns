import type { PageServerLoad } from './$types';
import { getConfig } from '$lib/server/config';
import { loadExplorePage } from '$lib/server/db/explore';
import { cachedTrendingTags, loadFreshTiles, loadSuggestions } from '$lib/server/explore';

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	const viewerId = locals.user?.id;
	const pageSize = getConfig(platform?.env).explore.defaultPageSize;
	const [first, trending, suggestions] = await Promise.all([
		loadExplorePage(locals.db, viewerId, { page: 0, pageSize }),
		cachedTrendingTags(locals.db, platform, url.origin),
		loadSuggestions(locals.db, viewerId, platform?.env)
	]);
	return {
		signedIn: Boolean(viewerId),
		tiles: await loadFreshTiles(locals.db, first.ids, platform?.env),
		hasMore: first.hasMore,
		trending,
		suggestions
	};
};
