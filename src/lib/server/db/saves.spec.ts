import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { post, postSave, user } from './schema';
import { loadViewerPostState, toPostCards } from './post-cards';
import { loadSavedPage } from './saves';
import { DELETE as unsave, PUT as save } from '../../../routes/api/posts/[id]/save/+server';
import { GET as listSaved } from '../../../routes/api/saved/+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Handler = (event: never) => Promise<Response>;

let db: Db;
let dispose: () => Promise<void>;

// alice writes p-1..p-3; bob saves them.
beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.batch([
		db.insert(user).values({ id: 'alice', name: 'Alice', email: 'a@test.dev', handle: 'alice' }),
		db.insert(user).values({ id: 'bob', name: 'Bob', email: 'b@test.dev' })
	]);
}, 60_000);

afterAll(() => dispose?.());

beforeEach(async () => {
	await db.delete(post);
	await db.batch([
		db.insert(post).values({ id: 'p-1', userId: 'alice', content: 'one' }),
		db.insert(post).values({ id: 'p-2', userId: 'alice', content: 'two' }),
		db.insert(post).values({ id: 'p-3', userId: 'alice', content: 'three' })
	]);
});

function call(
	handler: unknown,
	{ id = '', userId = null, search = '' }: { id?: string; userId?: string | null; search?: string }
): Promise<Response> {
	const url = new URL(`http://localhost/x${search}`);
	const event = {
		params: { id },
		url,
		locals: { db, user: userId ? { id: userId, name: userId, handle: null, image: null } : null }
	};
	return (handler as Handler)(event as never);
}

const savedIds = async (userId: string) =>
	(await db.select().from(postSave).where(eq(postSave.userId, userId))).map((r) => r.postId);

describe('saved posts on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	it('saves and unsaves idempotently', async () => {
		for (let i = 0; i < 2; i++) {
			const res = await call(save, { id: 'p-1', userId: 'bob' });
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ saved: true });
		}
		expect(await savedIds('bob')).toEqual(['p-1']);

		for (let i = 0; i < 2; i++) {
			const res = await call(unsave, { id: 'p-1', userId: 'bob' });
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ saved: false });
		}
		expect(await savedIds('bob')).toEqual([]);
	});

	it('requires sign-in and an existing, live post', async () => {
		expect((await call(save, { id: 'p-1' })).status).toBe(401);
		expect((await call(listSaved, {})).status).toBe(401);
		expect((await call(save, { id: 'nope', userId: 'bob' })).status).toBe(404);
		await db.update(post).set({ deletedAt: new Date() }).where(eq(post.id, 'p-2'));
		expect((await call(save, { id: 'p-2', userId: 'bob' })).status).toBe(404);
	});

	it('lists the latest saves first, pages without repeats and hides deleted posts', async () => {
		// Save p-1, p-2, p-3 with distinct times so the order is deterministic.
		await db.batch([
			db.insert(postSave).values({ userId: 'bob', postId: 'p-1', createdAt: new Date(1000) }),
			db.insert(postSave).values({ userId: 'bob', postId: 'p-2', createdAt: new Date(2000) }),
			db.insert(postSave).values({ userId: 'bob', postId: 'p-3', createdAt: new Date(3000) })
		]);

		const first = await call(listSaved, { userId: 'bob', search: '?limit=2' });
		expect(first.status).toBe(200);
		const page1 = (await first.json()) as {
			posts: Array<{ id: string; saved: boolean }>;
			nextCursor: string | null;
		};
		expect(page1.posts.map((p) => p.id)).toEqual(['p-3', 'p-2']);
		expect(page1.posts.every((p) => p.saved)).toBe(true);
		expect(page1.nextCursor).not.toBeNull();

		const second = await call(listSaved, {
			userId: 'bob',
			search: `?limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`
		});
		const page2 = (await second.json()) as { posts: Array<{ id: string }>; nextCursor: null };
		expect(page2.posts.map((p) => p.id)).toEqual(['p-1']);
		expect(page2.nextCursor).toBeNull();

		await db.update(post).set({ deletedAt: new Date() }).where(eq(post.id, 'p-3'));
		const after = await loadSavedPage(db, 'bob', { limit: 10 });
		expect(after.rows.map((r) => r.post.id)).toEqual(['p-2', 'p-1']);
	});

	it('keeps saves private to the saver', async () => {
		await call(save, { id: 'p-1', userId: 'bob' });
		const alice = await loadSavedPage(db, 'alice', { limit: 10 });
		expect(alice.rows).toEqual([]);

		const rows = (await loadSavedPage(db, 'bob', { limit: 10 })).rows;
		expect((await toPostCards(db, rows, 'alice'))[0].saved).toBe(false);
		expect((await toPostCards(db, rows, 'bob'))[0].saved).toBe(true);
	});

	it('rejects an invalid cursor', async () => {
		const res = await call(listSaved, { userId: 'bob', search: '?cursor=bad' });
		expect(res.status).toBe(400);
	});

	it('reports liked and saved only for the requested posts', async () => {
		await call(save, { id: 'p-2', userId: 'bob' });
		const state = await loadViewerPostState(db, 'bob', ['p-1', 'p-2']);
		expect([...state.saved]).toEqual(['p-2']);
		expect(state.liked.size).toBe(0);
		expect((await loadViewerPostState(db, null, ['p-2'])).saved.size).toBe(0);
	});
});
