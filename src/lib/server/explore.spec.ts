import { describe, expect, it, vi } from 'vitest';
import { TRENDING_CACHE_TTL_SEC, cachedTrendingTags } from './explore';
import * as exploreDb from '$lib/server/db/explore';

vi.mock('$lib/server/db/explore', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/db/explore')>()),
	loadTrendingTags: vi.fn(async () => [{ slug: 'film', name: 'Film', posts: 3 }])
}));

function memoryCache() {
	const store = new Map<string, Response>();
	return {
		store,
		cache: {
			match: vi.fn(async (key: string) => store.get(key)?.clone()),
			put: vi.fn(async (key: string, res: Response) => void store.set(key, res))
		}
	};
}

const db = {} as never;

describe('cachedTrendingTags', () => {
	it('computes once, then serves from the cache with a 10-minute TTL', async () => {
		const { cache, store } = memoryCache();
		const waitUntil = vi.fn();
		const platform = { caches: { default: cache }, ctx: { waitUntil } } as unknown as App.Platform;

		const first = await cachedTrendingTags(db, platform, 'https://sns.test');
		await waitUntil.mock.calls[0][0];
		const second = await cachedTrendingTags(db, platform, 'https://sns.test');

		expect(first).toEqual([{ slug: 'film', name: 'Film', posts: 3 }]);
		expect(second).toEqual(first);
		expect(exploreDb.loadTrendingTags).toHaveBeenCalledOnce();
		const cached = store.get('https://sns.test/__cache/explore/trending-tags');
		expect(cached?.headers.get('cache-control')).toBe(`public, max-age=${TRENDING_CACHE_TTL_SEC}`);
	});

	it('works without a cache', async () => {
		vi.mocked(exploreDb.loadTrendingTags).mockClear();
		expect(await cachedTrendingTags(db, undefined, 'https://sns.test')).toHaveLength(1);
		expect(exploreDb.loadTrendingTags).toHaveBeenCalledOnce();
	});
});
