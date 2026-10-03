import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { fakeRateLimiter } from '$lib/server/testing/rate-limiter';
import { user, userBlock } from '$lib/server/db/schema';
import type { ApiErrorBody } from '$lib/server/api';
import { GET } from './+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

interface SearchBody {
	query: string;
	users: { id: string; image: string | null }[];
	posts: { id: string }[];
}

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.batch([
		db.insert(user).values({ id: 'viewer', name: 'Viewer', email: 'v@test.dev' }),
		db.insert(user).values({
			id: 'river-1',
			name: 'River One',
			email: 'r1@test.dev',
			// A stored private-bucket URL, unusable in a browser until refreshed.
			image: 'https://acc.r2.cloudflarestorage.com/bucket/avatars/river-1/me.jpg'
		}),
		db.insert(user).values({ id: 'river-2', name: 'River Two', email: 'r2@test.dev' }),
		db.insert(user).values({ id: 'river-3', name: 'River Three', email: 'r3@test.dev' }),
		db.insert(userBlock).values({ blockerId: 'river-3', blockedId: 'viewer' })
	]);
}, 60_000);

afterAll(() => dispose?.());

function search(
	query: string,
	{ userId = null, platform }: { userId?: string | null; platform?: unknown } = {}
) {
	const url = new URL(`http://localhost/api/search${query}`);
	const event = {
		url,
		locals: { db, user: userId ? { id: userId } : null },
		platform,
		getClientAddress: () => '203.0.113.9'
	};
	return (GET as unknown as (e: typeof event) => Promise<Response>)(event);
}

async function bodyOf(res: Response) {
	expect(res.status).toBe(200);
	return (await res.json()) as SearchBody;
}

// Matching, ranking, FTS safety and type filtering are covered in db/search.spec.
describe('GET /api/search', { timeout: REAL_D1_TIMEOUT }, () => {
	it('echoes the query and returns users with servable avatars', async () => {
		const body = await bodyOf(await search('?q=river&type=users'));
		expect(body.query).toBe('river');
		expect(body.posts).toEqual([]);
		expect(body.users.map((u) => u.id).sort()).toEqual(['river-1', 'river-2', 'river-3']);
		expect(body.users.find((u) => u.id === 'river-1')?.image).toBe(
			'/api/media/avatars/river-1/me.jpg'
		);
	});

	it('caps each section at limit', async () => {
		expect((await bodyOf(await search('?q=river&limit=2'))).users).toHaveLength(2);
	});

	it('hides people blocked either way from a signed-in viewer', async () => {
		const body = await bodyOf(await search('?q=river', { userId: 'viewer' }));
		expect(body.users.map((u) => u.id).sort()).toEqual(['river-1', 'river-2']);
	});

	it('returns nothing, not an error, for input with no searchable term', async () => {
		expect(await bodyOf(await search('?q=ab'))).toEqual({ query: 'ab', users: [], posts: [] });
		expect(await bodyOf(await search(''))).toEqual({ query: '', users: [], posts: [] });
	});

	it('names the invalid parameter', async () => {
		for (const [query, field] of [
			['?type=bogus', 'type'],
			['?limit=0', 'limit'],
			['?limit=21', 'limit'],
			[`?q=${'x'.repeat(201)}`, 'q']
		]) {
			const res = await search(query);
			expect(res.status).toBe(400);
			expect(((await res.json()) as ApiErrorBody).error.fields).toHaveProperty(field);
		}
	});

	it('is rate limited per user, or per IP when signed out', async () => {
		const { namespace, windows, exhaust } = fakeRateLimiter();
		const platform = { env: { RATE_LIMITER: namespace } };
		exhaust('search', 'viewer');
		exhaust('search', 'ip:203.0.113.9');

		for (const userId of ['viewer', null]) {
			const res = await search('?q=river', { userId, platform });
			expect(res.status).toBe(429);
			expect(res.headers.get('Retry-After')).toMatch(/^\d+$/);
		}

		expect((await search('?q=river', { userId: 'river-1', platform })).status).toBe(200);
		expect(windows.get('search:river-1')?.count).toBe(1);
	});
});
