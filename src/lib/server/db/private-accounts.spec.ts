import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { fakeRateLimiter } from '$lib/server/testing/rate-limiter';
import {
	followRequest,
	notification,
	post,
	postComment,
	postLike,
	postSave,
	postTag,
	tag,
	user,
	userBlock,
	userFollow
} from './schema';
import { followStatus, setFollowing } from './follows';
import { loadFeedPage } from './posts';
import { loadExplorePage, loadTagPage } from './explore';
import { searchPosts, toFtsQuery } from './search';
import { loadSavedPage } from './saves';
import { createComment, listPostComments } from './comments';
import { loadProfilePosts } from './profiles';
import { canViewProfile } from './visibility';
import { DELETE as unfollow, POST as follow } from '../../../routes/api/users/[id]/follow/+server';
import { PATCH as updateUser } from '../../../routes/api/users/[id]/+server';
import { POST as block } from '../../../routes/api/users/[id]/block/+server';
import { GET as followers } from '../../../routes/api/users/[id]/followers/+server';
import { GET as listRequests } from '../../../routes/api/follow-requests/+server';
import {
	DELETE as decline,
	POST as approve
} from '../../../routes/api/follow-requests/[id]/+server';
import { POST as like } from '../../../routes/api/posts/[id]/like/+server';
import { PUT as save } from '../../../routes/api/posts/[id]/save/+server';
import { POST as share } from '../../../routes/api/posts/[id]/share/+server';
import { load as loadPostPage } from '../../../routes/post/[id]/+page.server';
import { load as loadProfilePage } from '../../../routes/profile/[id]/+page.server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Handler = (event: never) => Promise<Response>;

let db: Db;
let dispose: () => Promise<void>;

// `priv` is the private account and `fan` follows it; `pub` is public; `stranger` follows no one.
const PEOPLE = ['priv', 'fan', 'pub', 'stranger', 'r1', 'r2', 'r3'];

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db
		.insert(user)
		.values(PEOPLE.map((id) => ({ id, name: id, email: `${id}@test.dev`, handle: id })));
}, 60_000);

afterAll(() => dispose?.());

beforeEach(async () => {
	await db.batch([
		db.delete(followRequest),
		db.delete(userFollow),
		db.delete(userBlock),
		db.delete(notification),
		db.delete(post),
		db.delete(tag),
		db.update(user).set({ followersCount: 0, followingCount: 0, isPrivate: false })
	]);
});

function call(
	handler: unknown,
	{
		id = '',
		userId = null,
		body,
		query = '',
		platform
	}: {
		id?: string;
		userId?: string | null;
		body?: Record<string, unknown>;
		query?: string;
		platform?: unknown;
	}
): Promise<Response> {
	const url = new URL(`http://localhost/x${query}`);
	const event = {
		params: { id },
		url,
		request: new Request(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body ?? {})
		}),
		locals: {
			db,
			user: userId ? { id: userId, name: userId, handle: null, image: null } : null
		},
		platform
	};
	return (handler as Handler)(event as never);
}

const makePrivate = (id = 'priv') =>
	db.update(user).set({ isPrivate: true }).where(eq(user.id, id));

const counts = async (id: string) => {
	const [row] = await db
		.select({ followers: user.followersCount, following: user.followingCount })
		.from(user)
		.where(eq(user.id, id));
	return row;
};

const requests = async () =>
	(await db.select().from(followRequest)).map((r) => `${r.requesterId}->${r.targetId}`).sort();

const notices = async () =>
	(await db.select().from(notification))
		.map((n) => `${n.type}:${n.actorId}->${n.recipientId}`)
		.sort();

describe('follow requests on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	it('requests instead of following a private account, then cancels', async () => {
		await makePrivate();
		for (let i = 0; i < 2; i++) {
			const res = await call(follow, { id: 'priv', userId: 'stranger' });
			expect(await res.json()).toEqual({ status: 'requested', followersCount: 0 });
		}
		expect(await requests()).toEqual(['stranger->priv']);
		expect(await notices()).toEqual(['follow_request:stranger->priv']);
		expect(await db.select().from(userFollow)).toEqual([]);
		expect(await followStatus(db, 'stranger', 'priv')).toBe('requested');

		const res = await call(unfollow, { id: 'priv', userId: 'stranger' });
		expect(await res.json()).toEqual({ status: 'none', followersCount: 0 });
		expect(await requests()).toEqual([]);
		expect(await notices()).toEqual([]);
		expect(await followStatus(db, 'stranger', 'priv')).toBe('none');
	});

	it('lists incoming requests newest first, paginated, only to their target', async () => {
		await makePrivate();
		await db.insert(followRequest).values(
			['r1', 'r2', 'r3'].map((requesterId, i) => ({
				requesterId,
				targetId: 'priv',
				createdAt: new Date(Date.UTC(2026, 0, 1, 0, i))
			}))
		);
		const page = async (query: string) =>
			(await (await call(listRequests, { userId: 'priv', query })).json()) as {
				users: { id: string }[];
				nextCursor: string | null;
			};
		const first = await page('?limit=2');
		expect(first.users.map((u) => u.id)).toEqual(['r3', 'r2']);
		const second = await page(`?limit=2&cursor=${encodeURIComponent(first.nextCursor!)}`);
		expect(second).toMatchObject({ users: [{ id: 'r1' }], nextCursor: null });

		expect((await page('')).users).toHaveLength(3);
		expect((await (await call(listRequests, { userId: 'pub' })).json()) as never).toEqual({
			users: [],
			nextCursor: null
		});
		expect((await call(listRequests, {})).status).toBe(401);
	});

	it('approves a request: follow, counters, notifications, all at once', async () => {
		await makePrivate();
		await call(follow, { id: 'priv', userId: 'stranger' });

		const res = await call(approve, { id: 'stranger', userId: 'priv' });
		expect(res.status).toBe(200);
		expect(await requests()).toEqual([]);
		expect(await followStatus(db, 'stranger', 'priv')).toBe('following');
		expect(await counts('priv')).toEqual({ followers: 1, following: 0 });
		expect(await counts('stranger')).toEqual({ followers: 0, following: 1 });
		expect(await notices()).toEqual(['follow_accepted:priv->stranger']);

		// Nothing left to approve, and only the target can approve its own requests.
		expect((await call(approve, { id: 'stranger', userId: 'priv' })).status).toBe(404);
		await call(follow, { id: 'priv', userId: 'r1' });
		expect((await call(approve, { id: 'r1', userId: 'pub' })).status).toBe(404);
		expect(await requests()).toEqual(['r1->priv']);

		// Following an account you already follow does not ask again after it goes private.
		const again = await call(follow, { id: 'priv', userId: 'stranger' });
		expect(await again.json()).toEqual({ status: 'following', followersCount: 1 });
	});

	it('declines a request with its notification, idempotently', async () => {
		await makePrivate();
		await call(follow, { id: 'priv', userId: 'stranger' });
		for (let i = 0; i < 2; i++) {
			expect((await call(decline, { id: 'stranger', userId: 'priv' })).status).toBe(200);
		}
		expect(await requests()).toEqual([]);
		expect(await notices()).toEqual([]);
		expect(await counts('priv')).toEqual({ followers: 0, following: 0 });
	});

	it('rate limits approve and decline with the follow rule', async () => {
		const { namespace, windows } = fakeRateLimiter();
		const platform = { env: { RATE_LIMITER: namespace } };
		windows.set('follow:priv', { windowStart: Math.floor(Date.now() / 60_000) * 60, count: 30 });
		for (const handler of [approve, decline]) {
			expect((await call(handler, { id: 'stranger', userId: 'priv', platform })).status).toBe(429);
		}
	});

	it('going public approves every pending request', async () => {
		await makePrivate();
		await call(setPrivacy(true), { id: 'priv', userId: 'priv' });
		for (const id of ['r1', 'r2', 'r3']) await call(follow, { id: 'priv', userId: id });
		expect(await requests()).toHaveLength(3);

		const res = await call(setPrivacy(false), { id: 'priv', userId: 'priv' });
		expect(res.status).toBe(200);
		expect(((await res.json()) as { user: { isPrivate: boolean } }).user.isPrivate).toBe(false);
		expect(await requests()).toEqual([]);
		expect(await counts('priv')).toEqual({ followers: 3, following: 0 });
		for (const id of ['r1', 'r2', 'r3']) {
			expect(await counts(id)).toEqual({ followers: 0, following: 1 });
		}
		expect(await notices()).toEqual([
			'follow_accepted:priv->r1',
			'follow_accepted:priv->r2',
			'follow_accepted:priv->r3'
		]);
	});

	it('blocking clears pending requests both ways, with their notifications', async () => {
		await makePrivate('priv');
		await makePrivate('stranger');
		await call(follow, { id: 'priv', userId: 'stranger' });
		await call(follow, { id: 'stranger', userId: 'priv' });
		await call(follow, { id: 'priv', userId: 'r1' });
		expect(await requests()).toHaveLength(3);

		await call(block, { id: 'stranger', userId: 'priv' });
		expect(await requests()).toEqual(['r1->priv']);
		expect(await notices()).toEqual(['follow_request:r1->priv']);
	});
});

/** PATCH /api/users/:id handler bound to an `isPrivate` body. */
function setPrivacy(isPrivate: boolean) {
	return (event: { request: Request }) =>
		(updateUser as Handler)({
			...event,
			request: new Request('http://localhost/x', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ isPrivate })
			})
		} as never);
}

describe('PATCH /api/users/:id isPrivate', { timeout: REAL_D1_TIMEOUT }, () => {
	it('toggles the owner’s privacy and validates the value', async () => {
		const res = await call(setPrivacy(true), { id: 'priv', userId: 'priv' });
		expect(res.status).toBe(200);
		expect(((await res.json()) as { user: { isPrivate: boolean } }).user.isPrivate).toBe(true);
		const [row] = await db.select({ p: user.isPrivate }).from(user).where(eq(user.id, 'priv'));
		expect(row.p).toBe(true);

		const bad = await call(updateUser, { id: 'priv', userId: 'priv', body: { isPrivate: 'yes' } });
		expect(bad.status).toBe(400);
		expect((await call(setPrivacy(false), { id: 'priv', userId: 'pub' })).status).toBe(403);
	});
});

describe('private content visibility on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	const VIEWERS = { signedOut: null, stranger: 'stranger', fan: 'fan', owner: 'priv' } as const;

	beforeEach(async () => {
		await db.batch([
			db.insert(post).values({ id: 'pp', userId: 'priv', content: 'sunset private' }),
			db.insert(post).values({ id: 'pq', userId: 'pub', content: 'sunset public' }),
			db.insert(tag).values({ id: 't', slug: 'sunset', name: 'Sunset' }),
			db.insert(postTag).values({ postId: 'pp', tagId: 't', position: 0 }),
			db.insert(postTag).values({ postId: 'pq', tagId: 't', position: 0 }),
			db.insert(postComment).values({ id: 'c1', postId: 'pp', userId: 'priv', content: 'hi' })
		]);
		await setFollowing(db, 'fan', 'priv', true);
		await makePrivate();
	});

	/** For each viewer, whether `ids` returns the private post `pp`. */
	async function seesPrivate(ids: (viewerId: string | null) => Promise<string[]>) {
		const out: Record<string, boolean> = {};
		for (const [name, viewerId] of Object.entries(VIEWERS)) {
			out[name] = (await ids(viewerId)).includes('pp');
		}
		return out;
	}

	const onlyFollowersAndOwner = { signedOut: false, stranger: false, fan: true, owner: true };

	it('filters the feed, tags, search, comments and profile posts', async () => {
		expect(
			await seesPrivate(async (viewerId) =>
				(await loadFeedPage(db, { limit: 10, viewerId })).rows.map((r) => r.post.id)
			)
		).toEqual(onlyFollowersAndOwner);
		expect(
			await seesPrivate(
				async (viewerId) => (await loadTagPage(db, 'sunset', { limit: 10, viewerId })).ids
			)
		).toEqual(onlyFollowersAndOwner);
		const match = toFtsQuery('sunset')!;
		expect(
			await seesPrivate(async (viewerId) =>
				(await searchPosts(db, match, ['sunset'], 10, viewerId)).map((p) => p.id)
			)
		).toEqual(onlyFollowersAndOwner);
		expect(
			await seesPrivate(async (viewerId) =>
				(await loadProfilePosts(db, 'priv', viewerId, { limit: 10 })).posts.map((p) => p.id)
			)
		).toEqual(onlyFollowersAndOwner);
		expect(
			await seesPrivate(async (viewerId) => {
				const page = await listPostComments(db, { postId: 'pp', viewerId, limit: 10 }).catch(
					() => null
				);
				return page?.comments.length ? ['pp'] : [];
			})
		).toEqual(onlyFollowersAndOwner);
		for (const [name, viewerId] of Object.entries(VIEWERS)) {
			expect(await canViewProfile(db, viewerId, 'priv')).toBe(
				onlyFollowersAndOwner[name as keyof typeof onlyFollowersAndOwner]
			);
		}
	});

	it('keeps private posts out of Explore, signed out included', async () => {
		const explore = async (viewerId: string | null) =>
			(await loadExplorePage(db, viewerId, { page: 0, pageSize: 10 })).ids;
		expect(await explore(null)).toEqual(['pq']);
		expect(await explore('stranger')).toEqual(['pq']);
	});

	it('hides saved posts of a private account the saver stopped following', async () => {
		await db.insert(postSave).values({ userId: 'fan', postId: 'pp' });
		const saved = async () =>
			(await loadSavedPage(db, 'fan', { limit: 10 })).rows.map((r) => r.post.id);
		expect(await saved()).toEqual(['pp']);
		await setFollowing(db, 'fan', 'priv', false);
		expect(await saved()).toEqual([]);
	});

	it('gates the post page and follower lists on following', async () => {
		const openPost = (viewerId: string | null) =>
			loadPostPage({
				params: { id: 'pp' },
				url: new URL('http://localhost/post/pp'),
				locals: { db, user: viewerId ? { id: viewerId } : null },
				platform: undefined
			} as never);
		await expect(openPost(null)).rejects.toMatchObject({ status: 403 });
		await expect(openPost('stranger')).rejects.toMatchObject({ status: 403 });
		await expect(openPost('fan')).resolves.toMatchObject({ post: { id: 'pp' } });

		// A block hides the post entirely, which the page did not check before.
		await db.insert(userBlock).values({ blockerId: 'pub', blockedId: 'stranger' });
		const blocked = loadPostPage({
			params: { id: 'pq' },
			url: new URL('http://localhost/post/pq'),
			locals: { db, user: { id: 'stranger' } },
			platform: undefined
		} as never);
		await expect(blocked).rejects.toMatchObject({ status: 404 });

		const list = (viewerId: string | null) => call(followers, { id: 'priv', userId: viewerId });
		expect((await list(null)).status).toBe(403);
		expect((await list('stranger')).status).toBe(403);
		expect((await list('fan')).status).toBe(200);
		expect((await list('priv')).status).toBe(200);
	});

	it('shows a private profile as locked, with no posts, until followed', async () => {
		const openProfile = async (viewerId: string | null) =>
			(await loadProfilePage({
				params: { id: 'priv' },
				url: new URL('http://localhost/profile/priv'),
				locals: { db, user: viewerId ? { id: viewerId } : null },
				platform: undefined
			} as never)) as { isLocked: boolean; posts: unknown[] };
		expect(await openProfile('stranger')).toMatchObject({ isLocked: true, posts: [] });
		expect(await openProfile(null)).toMatchObject({ isLocked: true, posts: [] });
		expect((await openProfile('fan')).isLocked).toBe(false);
		expect((await openProfile('fan')).posts).toHaveLength(1);
		expect((await openProfile('priv')).isLocked).toBe(false);
	});

	it('404s likes, saves, shares and comments on posts the viewer cannot see', async () => {
		for (const handler of [like, save, share]) {
			expect((await call(handler, { id: 'pp', userId: 'stranger' })).status).toBe(404);
		}
		await expect(
			createComment(db, { postId: 'pp', author: { id: 'stranger', name: 's' }, content: 'yo' })
		).rejects.toMatchObject({ status: 404 });
		expect(await db.select().from(postLike)).toEqual([]);
		expect(await db.select().from(postSave)).toEqual([]);

		for (const handler of [like, save, share]) {
			expect((await call(handler, { id: 'pp', userId: 'fan' })).status).toBe(200);
		}
		await expect(
			createComment(db, { postId: 'pp', author: { id: 'fan', name: 'f' }, content: 'yo' })
		).resolves.toBeTruthy();
	});
});
