import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { post, user } from '$lib/server/db/schema';
import { EXPLORE_MAX_PAGES } from '$lib/server/db/explore';
import type { ApiErrorBody } from '$lib/server/api';
import { GET } from './+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.insert(user).values({ id: 'bob', name: 'Bob', email: 'b@test.dev' });
	await db.insert(post).values(
		Array.from({ length: 5 }, (_, i) => ({
			id: `p${i}`,
			userId: 'bob',
			content: `post ${i}`,
			createdAt: new Date(Date.now() - (i + 1) * 3_600_000)
		}))
	);
}, 60_000);

afterAll(() => dispose?.());

// A small page size from the environment, so a few posts span several pages.
const platform = { env: { EXPLORE_PAGE_SIZE: '2' } };

function explore(search: string) {
	const url = new URL(`http://localhost/api/explore${search}`);
	const event = { url, locals: { db, user: null }, platform };
	return (GET as unknown as (e: typeof event) => Promise<Response>)(event);
}

// Ranking, the viewer's own posts and blocks are covered in db/explore.spec and db/blocks.spec.
describe('GET /api/explore', { timeout: REAL_D1_TIMEOUT }, () => {
	it('pages tiles signed out, with hasMore until the last page', async () => {
		const seen: string[] = [];
		for (let page = 0; ; page++) {
			const res = await explore(`?page=${page}`);
			expect(res.status).toBe(200);
			const body = (await res.json()) as { tiles: { id: string }[]; hasMore: boolean };
			expect(body.tiles.length).toBeLessThanOrEqual(2);
			seen.push(...body.tiles.map((t) => t.id));
			if (!body.hasMore) break;
		}
		expect(seen.sort()).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
	});

	it.each(['-1', '1.5', 'abc', String(EXPLORE_MAX_PAGES + 1)])(
		'rejects page=%s with a field error',
		async (page) => {
			const res = await explore(`?page=${page}`);
			expect(res.status).toBe(400);
			expect(((await res.json()) as ApiErrorBody).error.fields).toHaveProperty('page');
		}
	);
});
