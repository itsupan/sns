import type { Database } from '$lib/server/db';
import { loadSuggestedCreators, loadTiles, loadTrendingTags } from '$lib/server/db/explore';
import { refreshMediaUrl } from '$lib/server/services/storage';
import { displayHandle } from '$lib/utils/format';
import type { ExploreTile, SuggestedCreator, TrendingTag } from '$lib/explore/types';

/** Tiles for `ids` with media URLs re-signed. */
export async function loadFreshTiles(
	db: Database,
	ids: string[],
	env: Partial<Env> | undefined
): Promise<ExploreTile[]> {
	const tiles = await loadTiles(db, ids);
	return Promise.all(
		tiles.map(async (t) =>
			t.cover ? { ...t, cover: { ...t.cover, url: await refreshMediaUrl(t.cover.url, env) } } : t
		)
	);
}

/** Suggested creators with display handles and re-signed avatars. */
export async function loadSuggestions(
	db: Database,
	viewerId: string | null | undefined,
	env: Partial<Env> | undefined
): Promise<SuggestedCreator[]> {
	const rows = await loadSuggestedCreators(db, viewerId);
	return Promise.all(
		rows.map(async (u) => ({
			id: u.id,
			name: u.name,
			handle: displayHandle(u.handle, u.name),
			slug: u.handle?.replace(/^@/, '') || u.id,
			image: u.image ? await refreshMediaUrl(u.image, env) : null,
			followersCount: u.followersCount,
			mutuals: u.mutuals
		}))
	);
}

/** Trending tags are the same for everyone, so one computation serves all viewers this long. */
export const TRENDING_CACHE_TTL_SEC = 600;

/**
 * Trending tags through the Workers Cache API (free, per data centre): a hit skips the D1
 * aggregate; a miss computes it and stores it in the background. Without a cache (tests, local
 * dev) it just computes.
 */
export async function cachedTrendingTags(
	db: Database,
	platform: App.Platform | undefined,
	origin: string
): Promise<TrendingTag[]> {
	const cache = (platform?.caches as { default?: Cache } | undefined)?.default;
	const key = `${origin}/__cache/explore/trending-tags`;
	if (cache) {
		const hit = await cache.match(key).catch(() => undefined);
		if (hit) return (await hit.json()) as TrendingTag[];
	}
	const tags = await loadTrendingTags(db);
	if (cache) {
		const response = new Response(JSON.stringify(tags), {
			headers: {
				'content-type': 'application/json',
				'cache-control': `public, max-age=${TRENDING_CACHE_TTL_SEC}`
			}
		});
		const store = cache.put(key, response).catch(() => {
			// A failed cache write only means the next request computes again.
		});
		if (platform?.ctx) platform.ctx.waitUntil(store);
		else await store;
	}
	return tags;
}
