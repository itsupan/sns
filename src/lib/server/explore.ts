import type { Database } from '$lib/server/db';
import { loadSuggestedCreators, loadTiles } from '$lib/server/db/explore';
import { refreshMediaUrl } from '$lib/server/services/storage';
import { displayHandle } from '$lib/utils/format';
import type { ExploreTile, SuggestedCreator } from '$lib/explore/types';

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
