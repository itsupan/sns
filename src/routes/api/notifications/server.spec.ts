import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { user } from '$lib/server/db/schema';
import { setFollowing } from '$lib/server/db/follows';
import type { ApiErrorBody } from '$lib/server/api';
import type { ActivityPage } from '$lib/activity/types';
import { GET } from './+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.batch([
		db.insert(user).values({ id: 'alice', name: 'Alice', email: 'a@test.dev' }),
		db.insert(user).values({
			id: 'bob',
			name: 'Bob',
			email: 'b@test.dev',
			// A stored private-bucket URL, unusable in a browser until refreshed.
			image: 'https://acc.r2.cloudflarestorage.com/bucket/avatars/bob/me.jpg'
		})
	]);
	await setFollowing(db, 'bob', 'alice', true);
}, 60_000);

afterAll(() => dispose?.());

function list(search: string) {
	const url = new URL(`http://localhost/api/notifications${search}`);
	const event = { url, locals: { db, user: { id: 'alice' } } };
	return (GET as unknown as (e: typeof event) => Promise<Response>)(event);
}

// Signed-out 401 and cursor paging are covered in db/notifications.spec.
describe('GET /api/notifications', { timeout: REAL_D1_TIMEOUT }, () => {
	it('serves activity with servable actor avatars', async () => {
		const res = await list('');
		expect(res.status).toBe(200);
		const page = (await res.json()) as ActivityPage;
		expect(page.nextCursor).toBeNull();
		expect(page.items).toEqual([
			expect.objectContaining({
				type: 'follow',
				unread: true,
				post: null,
				actor: expect.objectContaining({ id: 'bob', image: '/api/media/avatars/bob/me.jpg' })
			})
		]);
	});

	it('rejects a bad limit or cursor', async () => {
		for (const [search, field] of [
			['?limit=0', 'limit'],
			['?limit=51', 'limit'],
			['?cursor=nope', 'cursor']
		]) {
			const res = await list(search);
			expect(res.status).toBe(400);
			expect(((await res.json()) as ApiErrorBody).error.fields).toHaveProperty(field);
		}
	});
});
