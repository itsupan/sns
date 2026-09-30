import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { post, postTag, tag, user, userFollow } from './schema';
import {
	EXPLORE_MAX_PAGES,
	TRENDING_WINDOW_MS,
	exploreScore,
	loadExplorePage,
	loadSuggestedCreators,
	loadTagPage,
	loadTiles,
	loadTrendingTags
} from './explore';
import { setFollowing } from './follows';
import { GET as exploreApi } from '../../../routes/api/explore/+server';
import { GET as tagApi } from '../../../routes/api/tags/[slug]/+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Handler = (event: never) => Promise<Response>;

let db: Db;
let dispose: () => Promise<void>;

const NOW = 1_000 * 3600 * 1000; // a fixed "now", far from epoch
const HOUR = 3600 * 1000;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.batch([
		db.insert(user).values({ id: 'alice', name: 'Alice', email: 'a@t.dev', handle: 'alice' }),
		db.insert(user).values({ id: 'bob', name: 'Bob', email: 'b@t.dev', handle: 'bob' }),
		db.insert(user).values({ id: 'carol', name: 'Carol', email: 'c@t.dev' }),
		db.insert(user).values({ id: 'dan', name: 'Dan', email: 'd@t.dev' }),
		db.insert(user).values({ id: 'erin', name: 'Erin', email: 'e@t.dev' })
	]);
}, 60_000);

afterAll(() => dispose?.());

beforeEach(async () => {
	await db.batch([db.delete(post), db.delete(tag), db.delete(userFollow)]);
	await db.update(user).set({ followersCount: 0, followingCount: 0 }).where(eq(user.id, user.id));
});

function newPost(
	id: string,
	userId: string,
	{ hoursAgo = 1, likes = 0, comments = 0, views = 0 } = {}
) {
	return db.insert(post).values({
		id,
		userId,
		content: `post ${id}`,
		likesCount: likes,
		commentsCount: comments,
		viewsCount: views,
		createdAt: new Date(NOW - hoursAgo * HOUR)
	});
}

function call(
	handler: unknown,
	{
		params = {},
		userId = null,
		search = ''
	}: { params?: Record<string, string>; userId?: string | null; search?: string }
): Promise<Response> {
	const url = new URL(`http://localhost/x${search}`);
	const event = {
		params,
		url,
		locals: { db, user: userId ? { id: userId, name: userId, handle: null, image: null } : null }
	};
	return (handler as Handler)(event as never);
}

describe('explore on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	it('ranks by engagement per hour of age, matching exploreScore', async () => {
		await db.batch([
			newPost('old-popular', 'bob', { hoursAgo: 48, likes: 40, comments: 5 }),
			newPost('fresh-quiet', 'bob', { hoursAgo: 1 }),
			newPost('fresh-liked', 'carol', { hoursAgo: 2, likes: 6 }),
			newPost('viewed', 'carol', { hoursAgo: 3, views: 100 })
		]);
		const { ids } = await loadExplorePage(db, null, { page: 0, pageSize: 10, now: NOW });

		const all = await db.select().from(post);
		const expected = all
			.map((p) => ({ id: p.id, s: exploreScore({ ...p, createdAt: p.createdAt.getTime() }, NOW) }))
			.sort((a, b) => b.s - a.s)
			.map((p) => p.id);
		expect(ids).toEqual(expected);
		expect(ids[0]).toBe('fresh-liked');
	});

	it("leaves out the viewer's own posts, people they follow and deleted posts", async () => {
		await db.batch([
			newPost('mine', 'alice'),
			newPost('followed', 'bob'),
			newPost('stranger', 'carol'),
			newPost('gone', 'dan')
		]);
		await setFollowing(db, 'alice', 'bob', true);
		await db.update(post).set({ deletedAt: new Date() }).where(eq(post.id, 'gone'));

		const forAlice = await loadExplorePage(db, 'alice', { page: 0, pageSize: 10, now: NOW });
		expect(forAlice.ids).toEqual(['stranger']);
		const signedOut = await loadExplorePage(db, null, { page: 0, pageSize: 10, now: NOW });
		expect(signedOut.ids.sort()).toEqual(['followed', 'mine', 'stranger']);
	});

	it('pages without repeats and stops at the page cap', async () => {
		await db.batch(
			Array.from({ length: 7 }, (_, i) => newPost(`p${i}`, 'bob', { hoursAgo: i + 1 })) as [
				ReturnType<typeof newPost>,
				...ReturnType<typeof newPost>[]
			]
		);
		const seen: string[] = [];
		let page = 0;
		for (;;) {
			const r = await loadExplorePage(db, null, { page, pageSize: 3, now: NOW });
			seen.push(...r.ids);
			if (!r.hasMore) break;
			page++;
		}
		expect(seen).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
		expect(
			await loadExplorePage(db, null, { page: EXPLORE_MAX_PAGES, pageSize: 3, now: NOW })
		).toEqual({ ids: [], hasMore: false });
	});

	it('lists tag pages newest first by slug, skipping deleted posts', async () => {
		await db.batch([
			newPost('t1', 'bob', { hoursAgo: 3 }),
			newPost('t2', 'bob', { hoursAgo: 2 }),
			newPost('t3', 'bob', { hoursAgo: 1 }),
			db.insert(tag).values({ id: 'tag-film', slug: 'film', name: 'Film' }),
			db.insert(postTag).values([
				{ postId: 't1', tagId: 'tag-film', position: 0 },
				{ postId: 't2', tagId: 'tag-film', position: 0 },
				{ postId: 't3', tagId: 'tag-film', position: 0 }
			])
		]);
		await db.update(post).set({ deletedAt: new Date() }).where(eq(post.id, 't2'));

		const first = await loadTagPage(db, 'film', { limit: 1 });
		expect(first.tag).toEqual({ slug: 'film', name: 'Film' });
		expect(first.ids).toEqual(['t3']);
		const { decodeCursor } = await import('./posts');
		const second = await loadTagPage(db, 'film', {
			limit: 1,
			cursor: decodeCursor(first.nextCursor!)
		});
		expect(second.ids).toEqual(['t1']);
		expect(second.nextCursor).toBeNull();
		expect((await loadTagPage(db, 'nope', { limit: 5 })).tag).toBeNull();

		const res = await call(tagApi, { params: { slug: 'FILM' }, search: '?limit=5' });
		expect(res.status).toBe(200);
		expect(((await res.json()) as { tiles: Array<{ id: string }> }).tiles.map((t) => t.id)).toEqual(
			['t3', 't1']
		);
		expect((await call(tagApi, { params: { slug: 'nope' } })).status).toBe(404);
	});

	it('ranks trending tags by recent live posts', async () => {
		await db.batch([
			newPost('a', 'bob', { hoursAgo: 1 }),
			newPost('b', 'bob', { hoursAgo: 2 }),
			newPost('c', 'bob', { hoursAgo: 3 }),
			newPost('old', 'bob', { hoursAgo: TRENDING_WINDOW_MS / HOUR + 1 }),
			db.insert(tag).values([
				{ id: 'x', slug: 'street', name: 'Street' },
				{ id: 'y', slug: 'film', name: 'Film' },
				{ id: 'z', slug: 'stale', name: 'Stale' }
			]),
			db.insert(postTag).values([
				{ postId: 'a', tagId: 'x', position: 0 },
				{ postId: 'b', tagId: 'x', position: 0 },
				{ postId: 'c', tagId: 'y', position: 0 },
				{ postId: 'old', tagId: 'z', position: 0 }
			])
		]);
		expect(await loadTrendingTags(db, { now: NOW })).toEqual([
			{ slug: 'street', name: 'Street', posts: 2 },
			{ slug: 'film', name: 'Film', posts: 1 }
		]);
		await db.update(post).set({ deletedAt: new Date() }).where(eq(post.id, 'c'));
		expect((await loadTrendingTags(db, { now: NOW })).map((t) => t.slug)).toEqual(['street']);
	});

	it('suggests friends of friends first, then popular creators, never self or followed', async () => {
		// alice follows bob and carol; both follow dan, carol also follows erin.
		for (const [a, b] of [
			['alice', 'bob'],
			['alice', 'carol'],
			['bob', 'dan'],
			['carol', 'dan'],
			['carol', 'erin'],
			['carol', 'alice']
		])
			await setFollowing(db, a, b, true);

		const forAlice = await loadSuggestedCreators(db, 'alice', 6);
		expect(forAlice.map((u) => [u.id, u.mutuals])).toEqual([
			['dan', 2],
			['erin', 1]
		]);

		const signedOut = await loadSuggestedCreators(db, null, 2);
		expect(signedOut.map((u) => u.id)).toEqual(['dan', 'alice']);
	});

	it('builds tiles in the requested order and serves the explore API', async () => {
		await db.batch([newPost('one', 'bob', { likes: 3 }), newPost('two', 'carol')]);
		const tiles = await loadTiles(db, ['two', 'missing', 'one']);
		expect(tiles.map((t) => [t.id, t.likes, t.cover])).toEqual([
			['two', 0, null],
			['one', 3, null]
		]);

		const res = await call(exploreApi, { userId: 'bob' });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ tiles: [{ id: 'two' }], hasMore: false });
		expect((await call(exploreApi, { search: '?page=-1' })).status).toBe(400);
	});
});
