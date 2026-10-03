import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { fakeRateLimiter } from '$lib/server/testing/rate-limiter';
import { user } from '$lib/server/db/schema';
import type { ApiErrorBody } from '$lib/server/api';
import { GET } from './+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.insert(user).values([
		{ id: 'viewer', name: 'Viewer', email: 'v@test.dev', handle: 'viewer' },
		...Array.from({ length: 8 }, (_, i) => ({
			id: `sam-${i}`,
			name: `Sam ${i}`,
			email: `sam${i}@test.dev`,
			handle: `sam${i}`,
			// A stored private-bucket URL, unusable in a browser until refreshed.
			image: i === 0 ? 'https://acc.r2.cloudflarestorage.com/bucket/avatars/sam-0/me.jpg' : null
		}))
	]);
}, 60_000);

afterAll(() => dispose?.());

function suggest(
	q: string,
	{ userId = 'viewer', platform }: { userId?: string | null; platform?: unknown } = {}
) {
	const url = new URL(`http://localhost/api/users/suggest?${new URLSearchParams({ q })}`);
	const event = { url, locals: { db, user: userId ? { id: userId } : null }, platform };
	return (GET as unknown as (e: typeof event) => Promise<Response>)(event);
}

// Prefix matching, follow order, self and blocks are covered in db/mentions.spec.
describe('GET /api/users/suggest', { timeout: REAL_D1_TIMEOUT }, () => {
	it('requires sign-in', async () => {
		expect((await suggest('sam', { userId: null })).status).toBe(401);
	});

	it('suggests at most six people, with servable avatars', async () => {
		const res = await suggest('sam');
		expect(res.status).toBe(200);
		const { users } = (await res.json()) as { users: { id: string; image: string | null }[] };
		expect(users).toHaveLength(6);
		expect(users.find((u) => u.id === 'sam-0')?.image).toBe('/api/media/avatars/sam-0/me.jpg');
	});

	it('rejects a query longer than any handle', async () => {
		const res = await suggest('s'.repeat(32));
		expect(res.status).toBe(400);
		expect(((await res.json()) as ApiErrorBody).error.fields).toHaveProperty('q');
	});

	it('is rate limited per user with the search rule', async () => {
		const { namespace, windows, exhaust } = fakeRateLimiter();
		const platform = { env: { RATE_LIMITER: namespace } };
		exhaust('search', 'viewer');

		const res = await suggest('sam', { platform });
		expect(res.status).toBe(429);
		expect(res.headers.get('Retry-After')).toMatch(/^\d+$/);

		expect((await suggest('sam', { userId: 'sam-1', platform })).status).toBe(200);
		expect(windows.get('search:sam-1')?.count).toBe(1);
	});
});
