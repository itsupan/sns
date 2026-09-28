import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { post, user } from './schema';
import { GET as listPosts } from '../../../routes/api/posts/+server';
import { POST as toggleLike } from '../../../routes/api/posts/[id]/like/+server';
import { POST as sharePost } from '../../../routes/api/posts/[id]/share/+server';
import { POST as createComment } from '../../../routes/api/posts/[id]/comments/+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Handler = (event: never) => Promise<Response>;

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.insert(user).values({ id: 'u-1', name: 'u-1', email: 'u-1@test.dev' });
	await db.insert(post).values([
		{ id: 'live', userId: 'u-1', content: 'visible' },
		{ id: 'gone', userId: 'u-1', content: 'deleted', deletedAt: new Date() }
	]);
}, 60_000);

afterAll(() => dispose?.());

function call(handler: Handler, id: string, body?: unknown) {
	const event = {
		params: { id },
		url: new URL('http://localhost/api/posts'),
		locals: { db, user: { id: 'u-1', name: 'u-1' } },
		request: new Request('http://localhost', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body ?? {})
		})
	};
	return (handler as (e: typeof event) => Promise<Response>)(event);
}

describe('soft-deleted posts on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	it('are excluded from the feed', async () => {
		const res = await call(listPosts as Handler, '');
		const { posts } = (await res.json()) as { posts: { id: string }[] };
		expect(posts.map((p) => p.id)).toEqual(['live']);
	});

	it('cannot be liked, commented on or shared', async () => {
		expect((await call(toggleLike as Handler, 'gone')).status).toBe(404);
		expect((await call(sharePost as Handler, 'gone')).status).toBe(404);
		expect((await call(createComment as Handler, 'gone', { content: 'hi' })).status).toBe(404);
	});

	it('still allows interacting with live posts', async () => {
		expect((await call(toggleLike as Handler, 'live')).status).toBe(200);
		expect((await call(sharePost as Handler, 'live')).status).toBe(200);
	});
});
