import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { post, postMedia, postSave, user } from '$lib/server/db/schema';
import type { ApiErrorBody } from '$lib/server/api';
import { GET } from './+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.batch([
		db.insert(user).values({ id: 'alice', name: 'Alice', email: 'a@test.dev' }),
		db.insert(user).values({ id: 'bob', name: 'Bob', email: 'b@test.dev' }),
		db.insert(post).values({ id: 'p-1', userId: 'alice', content: 'one' }),
		db.insert(post).values({ id: 'p-2', userId: 'alice', content: 'two' }),
		db.insert(postMedia).values({
			id: 'm-1',
			postId: 'p-2',
			// A stored private-bucket URL, unusable in a browser until refreshed.
			url: 'https://acc.r2.cloudflarestorage.com/bucket/posts/alice/two.jpg',
			type: 'image',
			position: 0
		}),
		db.insert(postSave).values({ userId: 'bob', postId: 'p-1', createdAt: new Date(1000) }),
		db.insert(postSave).values({ userId: 'bob', postId: 'p-2', createdAt: new Date(2000) })
	]);
}, 60_000);

afterAll(() => dispose?.());

function saved(search: string) {
	const url = new URL(`http://localhost/api/saved${search}`);
	const event = { url, locals: { db, user: { id: 'bob' } } };
	return (GET as unknown as (e: typeof event) => Promise<Response>)(event);
}

// Signed-out 401, order, paging, privacy and a bad cursor are covered in db/saves.spec.
describe('GET /api/saved', { timeout: REAL_D1_TIMEOUT }, () => {
	it('returns cards with hasMore and servable media', async () => {
		const res = await saved('?limit=1');
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			posts: { id: string; mediaItems: { url: string }[] }[];
			hasMore: boolean;
			nextCursor: string | null;
		};
		expect(body.hasMore).toBe(true);
		expect(body.nextCursor).toEqual(expect.any(String));
		expect(body.posts.map((p) => p.id)).toEqual(['p-2']);
		expect(body.posts[0].mediaItems.map((m) => m.url)).toEqual(['/api/media/posts/alice/two.jpg']);
	});

	it('rejects a bad limit with a field error', async () => {
		for (const limit of ['0', '51', 'abc']) {
			const res = await saved(`?limit=${limit}`);
			expect(res.status).toBe(400);
			expect(((await res.json()) as ApiErrorBody).error.fields).toHaveProperty('limit');
		}
	});
});
