import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { count, eq } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { fakeRateLimiter } from '$lib/server/testing/rate-limiter';
import { user, userFollow } from '$lib/server/db/schema';
import type { ApiErrorBody } from '$lib/server/api';
import { loadFollowedIds } from '$lib/server/db/follows';
import { DELETE as unfollow, POST as follow } from './+server';
import { GET as getUser } from '../+server';
import { GET as getFollowers } from '../followers/+server';
import { GET as getFollowing } from '../following/+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Handler = (event: never) => Promise<Response>;

interface ListBody {
	users: { id: string; isFollowing: boolean; followedAt: number }[];
	hasMore: boolean;
	nextCursor: string | null;
}

let db: Db;
let dispose: () => Promise<void>;
const FANS = Array.from({ length: 5 }, (_, i) => `fan-${i}`);

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.insert(user).values(
		['star', 'viewer', ...FANS].map((id) => ({
			id,
			name: id,
			email: `${id}@test.dev`,
			handle: id
		}))
	);
}, 60_000);

afterAll(() => dispose?.());

beforeEach(async () => {
	await db.delete(userFollow);
	await db.update(user).set({ followersCount: 0, followingCount: 0 });
});

function call(
	handler: Handler,
	{
		id,
		userId,
		query = '',
		platform
	}: { id: string; userId: string | null; query?: string; platform?: unknown }
) {
	const event = {
		params: { id },
		url: new URL(`http://localhost/api/users/${id}${query}`),
		locals: { db, user: userId ? { id: userId, name: userId } : null },
		platform,
		request: new Request('http://localhost', { method: 'POST' })
	};
	return (handler as (e: typeof event) => Promise<Response>)(event);
}

async function counters(id: string) {
	const [row] = await db
		.select({ followers: user.followersCount, following: user.followingCount })
		.from(user)
		.where(eq(user.id, id));
	return row;
}

async function edgeCount() {
	const [row] = await db.select({ n: count() }).from(userFollow);
	return row.n;
}

describe('POST / DELETE /api/users/:id/follow', { timeout: REAL_D1_TIMEOUT }, () => {
	it('follows and updates both users’ counters', async () => {
		const res = await call(follow as Handler, { id: 'star', userId: 'viewer' });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ status: 'following', followersCount: 1 });
		expect(await counters('star')).toEqual({ followers: 1, following: 0 });
		expect(await counters('viewer')).toEqual({ followers: 0, following: 1 });
	});

	it('is idempotent: following twice keeps one follow and the same counts', async () => {
		await call(follow as Handler, { id: 'star', userId: 'viewer' });
		const again = await call(follow as Handler, { id: 'star', userId: 'viewer' });
		expect(again.status).toBe(200);
		expect(await again.json()).toEqual({ status: 'following', followersCount: 1 });
		expect(await edgeCount()).toBe(1);
		expect(await counters('viewer')).toEqual({ followers: 0, following: 1 });
	});

	it('unfollows idempotently, including when not following', async () => {
		await call(follow as Handler, { id: 'star', userId: 'viewer' });
		for (let i = 0; i < 2; i++) {
			const res = await call(unfollow as Handler, { id: 'star', userId: 'viewer' });
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ status: 'none', followersCount: 0 });
		}
		expect(await edgeCount()).toBe(0);
		expect(await counters('star')).toEqual({ followers: 0, following: 0 });
		expect(await counters('viewer')).toEqual({ followers: 0, following: 0 });
	});

	it('rejects self-follow and self-unfollow with 400', async () => {
		for (const handler of [follow, unfollow]) {
			const res = await call(handler as Handler, { id: 'viewer', userId: 'viewer' });
			expect(res.status).toBe(400);
			expect(((await res.json()) as ApiErrorBody).error.code).toBe('validation_failed');
		}
		expect(await edgeCount()).toBe(0);
		expect(await counters('viewer')).toEqual({ followers: 0, following: 0 });
	});

	it('requires sign-in and an existing user', async () => {
		expect((await call(follow as Handler, { id: 'star', userId: null })).status).toBe(401);
		expect((await call(unfollow as Handler, { id: 'star', userId: null })).status).toBe(401);
		expect((await call(follow as Handler, { id: 'ghost', userId: 'viewer' })).status).toBe(404);
		expect((await call(unfollow as Handler, { id: 'ghost', userId: 'viewer' })).status).toBe(404);
	});

	it('is rate limited per user with the follow rule', async () => {
		const { namespace, windows } = fakeRateLimiter();
		const platform = { env: { RATE_LIMITER: namespace } };
		// Window already at the 30/min limit for this user.
		windows.set('follow:viewer', { windowStart: Math.floor(Date.now() / 60_000) * 60, count: 30 });

		for (const handler of [follow, unfollow]) {
			const res = await call(handler as Handler, { id: 'star', userId: 'viewer', platform });
			expect(res.status).toBe(429);
			expect(res.headers.get('Retry-After')).toMatch(/^\d+$/);
		}
		expect(await edgeCount()).toBe(0);

		// Another user is unaffected, and the request is counted against the follow bucket.
		const ok = await call(follow as Handler, { id: 'star', userId: 'fan-0', platform });
		expect(ok.status).toBe(200);
		expect(windows.get('follow:fan-0')?.count).toBe(1);
	});

	it('keeps counters equal to rows under concurrent follow/unfollow', async () => {
		await Promise.all(FANS.map((fan) => call(follow as Handler, { id: 'star', userId: fan })));
		expect(await counters('star')).toEqual({ followers: FANS.length, following: 0 });

		await Promise.all(
			FANS.slice(0, 3).map((fan) => call(unfollow as Handler, { id: 'star', userId: fan }))
		);
		expect(await counters('star')).toEqual({ followers: 2, following: 0 });
		expect(await edgeCount()).toBe(2);
	});
});

describe('GET /api/users/:id isFollowing', { timeout: REAL_D1_TIMEOUT }, () => {
	async function getAs(id: string, viewer: string | null) {
		const res = await call(getUser as Handler, { id, userId: viewer });
		expect(res.status).toBe(200);
		return ((await res.json()) as { user: Record<string, unknown> }).user;
	}

	it('reflects whether the viewer follows the user, with counts', async () => {
		expect(await getAs('star', 'viewer')).toMatchObject({ isFollowing: false, followersCount: 0 });
		await call(follow as Handler, { id: 'star', userId: 'viewer' });
		expect(await getAs('star', 'viewer')).toMatchObject({ isFollowing: true, followersCount: 1 });
		expect(await getAs('viewer', 'viewer')).toMatchObject({
			isFollowing: false,
			followingCount: 1
		});
		expect((await getAs('star', null)).isFollowing).toBe(false);
		expect((await getAs('star', 'fan-0')).isFollowing).toBe(false);
	});
});

describe('GET /api/users/:id/followers and /following', { timeout: REAL_D1_TIMEOUT }, () => {
	beforeEach(async () => {
		// fan-0 followed first … fan-4 last; the viewer follows fan-1 and fan-3.
		await db.insert(userFollow).values(
			FANS.map((fan, i) => ({
				followerId: fan,
				followingId: 'star',
				createdAt: new Date(Date.UTC(2026, 0, 1, 0, i))
			}))
		);
		await db.insert(userFollow).values([
			{ followerId: 'viewer', followingId: 'fan-1' },
			{ followerId: 'viewer', followingId: 'fan-3' }
		]);
	});

	async function list(handler: unknown, id: string, query: string, viewer: string | null = null) {
		const res = await call(handler as Handler, { id, userId: viewer, query });
		expect(res.status).toBe(200);
		return (await res.json()) as ListBody;
	}

	it('pages followers newest first with a cursor, without gaps or repeats', async () => {
		const seen: string[] = [];
		let cursor: string | null = null;
		let pages = 0;
		do {
			const query: string = `?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
			const page = await list(getFollowers, 'star', query);
			seen.push(...page.users.map((u) => u.id));
			expect(page.hasMore).toBe(page.nextCursor !== null);
			cursor = page.nextCursor;
			pages++;
		} while (cursor);

		expect(pages).toBe(3);
		expect(seen).toEqual(['fan-4', 'fan-3', 'fan-2', 'fan-1', 'fan-0']);
	});

	it('marks the people the viewer follows', async () => {
		const page = await list(getFollowers, 'star', '?limit=50', 'viewer');
		const followed = page.users.filter((u) => u.isFollowing).map((u) => u.id);
		expect(followed.sort()).toEqual(['fan-1', 'fan-3']);
		expect(page.hasMore).toBe(false);
		expect(page.nextCursor).toBeNull();
	});

	it('lists who a user follows', async () => {
		const page = await list(getFollowing, 'fan-2', '');
		expect(page.users.map((u) => u.id)).toEqual(['star']);
		const viewer = await list(getFollowing, 'viewer', '');
		expect(viewer.users.map((u) => u.id).sort()).toEqual(['fan-1', 'fan-3']);
	});

	it('validates limit and cursor and 404s unknown users', async () => {
		for (const query of ['?limit=0', '?limit=51', '?limit=abc', '?cursor=nope']) {
			const res = await call(getFollowers as Handler, { id: 'star', userId: null, query });
			expect(res.status).toBe(400);
		}
		const res = await call(getFollowing as Handler, { id: 'ghost', userId: null });
		expect(res.status).toBe(404);
	});
});

describe('loadFollowedIds (feed Follow / Following)', { timeout: REAL_D1_TIMEOUT }, () => {
	it('returns only the authors the viewer follows, never the viewer', async () => {
		await call(follow as Handler, { id: 'star', userId: 'viewer' });
		const ids = await loadFollowedIds(db, 'viewer', ['star', 'fan-0', 'viewer', 'star']);
		expect([...ids]).toEqual(['star']);
		expect((await loadFollowedIds(db, null, ['star'])).size).toBe(0);
	});
});
