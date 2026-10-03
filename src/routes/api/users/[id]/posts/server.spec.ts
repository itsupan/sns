import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { post, postLike, postMedia, user, userBlock } from '$lib/server/db/schema';
import type { ApiErrorBody } from '$lib/server/api';
import type { GridItem } from '$lib/components/profile/ProfileGrid.svelte';
import { GET } from './+server';
import type { RequestEvent } from './$types';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

let db: Db;
let dispose: () => Promise<void>;

// Newest first; p-4a and p-4b share a timestamp (the id breaks the tie) and a page of 3 splits them.
const LIVE = ['p-6', 'p-5', 'p-4b', 'p-4a', 'p-3', 'p-2', 'p-1'];

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.insert(user).values(
		['author', 'viewer', 'blocked', 'blocker'].map((id) => ({
			id,
			name: id,
			email: `${id}@test.dev`
		}))
	);
	const at = (n: number) => new Date(Date.UTC(2026, 0, n));
	await db.insert(post).values([
		...['p-1', 'p-2', 'p-3'].map((id, i) => ({
			id,
			userId: 'author',
			content: id,
			createdAt: at(i + 1)
		})),
		{ id: 'p-4a', userId: 'author', content: 'p-4a', createdAt: at(4) },
		{ id: 'p-4b', userId: 'author', content: 'p-4b', createdAt: at(4) },
		{ id: 'p-5', userId: 'author', content: 'p-5', createdAt: at(5) },
		{ id: 'p-6', userId: 'author', content: 'p-6', createdAt: at(6), likesCount: 1 },
		{ id: 'gone', userId: 'author', content: 'gone', createdAt: at(7), deletedAt: at(8) },
		{ id: 'other', userId: 'viewer', content: 'not theirs', createdAt: at(9) }
	]);
	await db.insert(postMedia).values([
		{ id: 'm-1', postId: 'p-6', url: '/api/media/posts/author/a.jpg', type: 'image', position: 0 },
		{ id: 'm-2', postId: 'p-6', url: '/api/media/posts/author/b.jpg', type: 'image', position: 1 }
	]);
	await db.insert(postLike).values({ id: 'l-1', postId: 'p-6', userId: 'viewer' });
	await db.insert(userBlock).values([
		{ blockerId: 'author', blockedId: 'blocked' },
		{ blockerId: 'blocker', blockedId: 'author' }
	]);
}, 60_000);

afterAll(() => dispose?.());

type Page = { posts: GridItem[]; nextCursor: string | null };

async function list(
	id: string,
	{
		viewer = null,
		query = '',
		env = {}
	}: { viewer?: string | null; query?: string; env?: Record<string, string> } = {}
) {
	const res = await GET({
		params: { id },
		url: new URL(`http://localhost/api/users/${id}/posts${query}`),
		locals: { db, user: viewer ? { id: viewer } : null },
		platform: { env }
	} as unknown as RequestEvent);
	return { status: res.status, body: (await res.json()) as Page & Partial<ApiErrorBody> };
}

describe('GET /api/users/:id/posts', { timeout: REAL_D1_TIMEOUT }, () => {
	it('pages through live posts newest first, without gaps or repeats', async () => {
		const seen: string[] = [];
		let cursor: string | null = null;
		do {
			const query: string = `?limit=3${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
			const { status, body } = await list('author', { query });
			expect(status).toBe(200);
			expect(body.posts.length).toBeLessThanOrEqual(3);
			seen.push(...body.posts.map((p) => p.id));
			cursor = body.nextCursor;
		} while (cursor);
		expect(seen).toEqual(LIVE);
	});

	it('uses PROFILE_PAGE_SIZE when the client asks for no limit', async () => {
		const { body } = await list('author', { env: { PROFILE_PAGE_SIZE: '2' } });
		expect(body.posts.map((p) => p.id)).toEqual(LIVE.slice(0, 2));
		expect(body.nextCursor).not.toBeNull();
	});

	it('returns grid items carrying the full post with the viewer’s state', async () => {
		const { body } = await list('author', { viewer: 'viewer', query: '?limit=1' });
		const [item] = body.posts;
		expect(item).toMatchObject({
			id: 'p-6',
			image: '/api/media/posts/author/a.jpg',
			mediaType: 'image',
			isCarousel: true,
			likes: 1,
			post: { id: 'p-6', liked: true, saved: false, author: { id: 'author' } }
		});
	});

	it('shows the posts to everyone else, the author included', async () => {
		for (const viewer of [null, 'viewer', 'author']) {
			const { body } = await list('author', { viewer, query: '?limit=1' });
			expect(body.posts.map((p) => p.id)).toEqual(['p-6']);
		}
	});

	it('hides them like the profile page when either one blocked the other', async () => {
		for (const viewer of ['blocked', 'blocker']) {
			const { status, body } = await list('author', { viewer });
			expect(status).toBe(200);
			expect(body).toEqual({ posts: [], nextCursor: null });
		}
	});

	it('rejects an unknown user and a malformed cursor', async () => {
		expect((await list('nobody')).status).toBe(404);
		const bad = await list('author', { query: '?cursor=nope' });
		expect(bad.status).toBe(400);
		expect(bad.body).toMatchObject({ error: { code: 'validation_failed' } });
	});
});
