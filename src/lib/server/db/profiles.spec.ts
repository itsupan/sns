import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { post, postTag, user } from './schema';
import { loadPostTags } from './posts';
import { loadProfilePosts, loadProfileStats } from './profiles';
import { setFollowing } from './follows';
import { DELETE as deletePost, PATCH as editPost } from '../../../routes/api/posts/[id]/+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Handler = (event: never) => Promise<Response>;

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.insert(user).values(
		['alice', 'bob', 'carol'].map((id) => ({
			id,
			name: id,
			email: `${id}@test.dev`,
			handle: id
		}))
	);
	await db.insert(post).values([
		{ id: 'a-1', userId: 'alice', content: 'first', viewsCount: 10 },
		{ id: 'a-2', userId: 'alice', content: 'second', viewsCount: 5 },
		{ id: 'a-3', userId: 'alice', content: 'gone', viewsCount: 100, deletedAt: new Date() }
	]);
}, 60_000);

afterAll(() => dispose?.());

function call(
	handler: Handler,
	{
		id,
		userId,
		method = 'POST',
		body
	}: { id: string; userId: string | null; method?: string; body?: unknown }
) {
	const event = {
		params: { id },
		locals: { db, user: userId ? { id: userId, name: userId } : null },
		request: new Request('http://localhost', {
			method,
			headers: { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		})
	};
	return (handler as (e: typeof event) => Promise<Response>)(event);
}

describe('profiles on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	it('profile stats read the stored follow counters and viewer state', async () => {
		await setFollowing(db, 'bob', 'alice', true);
		await setFollowing(db, 'carol', 'alice', true);

		expect(await loadProfileStats(db, 'alice', 'bob')).toEqual({
			postsCount: 2,
			followersCount: 2,
			followingCount: 0,
			// Deleted posts' views do not count.
			impressionsCount: 15,
			followStatus: 'following'
		});
		expect((await loadProfileStats(db, 'bob', null)).followingCount).toBe(1);
		// Your own profile never shows "following yourself".
		expect((await loadProfileStats(db, 'alice', 'alice')).followStatus).toBe('none');

		await setFollowing(db, 'bob', 'alice', false);
		expect(await loadProfileStats(db, 'alice', 'bob')).toMatchObject({
			followersCount: 1,
			followStatus: 'none'
		});
	});

	it('lists live posts in feed shape with the viewer like state', async () => {
		const { posts, nextCursor } = await loadProfilePosts(db, 'alice', 'bob', { limit: 10 });
		expect(posts.map((p) => p.id).sort()).toEqual(['a-1', 'a-2']);
		expect(nextCursor).toBeNull();
		expect(posts[0].author.handle).toBe('@alice');
		expect(posts[0].liked).toBe(false);
	});

	it('lets the author edit title, content, location and tags', async () => {
		const res = await call(editPost as Handler, {
			id: 'a-1',
			userId: 'alice',
			method: 'PATCH',
			body: {
				title: ' New title ',
				content: 'edited',
				location: '',
				tags: ['#Light', 'light', 'Film']
			}
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			post: {
				id: 'a-1',
				title: 'New title',
				description: 'edited',
				tags: ['#Light', '#Film'],
				// Untouched media stays as it was.
				mediaItems: []
			}
		});

		// Replacing tags drops the old links.
		await call(editPost as Handler, {
			id: 'a-1',
			userId: 'alice',
			method: 'PATCH',
			body: { tags: ['Mono'] }
		});
		expect((await loadPostTags(db, ['a-1'])).get('a-1')).toEqual(['#Mono']);
		const links = await db.select().from(postTag).where(eq(postTag.postId, 'a-1'));
		expect(links).toHaveLength(1);
	});

	it('lets the author replace media, ratio and post type like the create form', async () => {
		const res = await call(editPost as Handler, {
			id: 'a-1',
			userId: 'alice',
			method: 'PATCH',
			body: {
				mediaUrls: [
					{ url: '/api/media/posts/alice/b.mp4' },
					{ url: '/api/media/posts/alice/a.jpg', type: 'image' }
				],
				aspectRatio: '4:5',
				postType: 'story'
			}
		});
		expect(res.status).toBe(200);
		const { post: edited } = (await res.json()) as { post: Record<string, unknown> };
		expect(edited).toMatchObject({
			mediaItems: [
				{ url: '/api/media/posts/alice/b.mp4', type: 'video' },
				{ url: '/api/media/posts/alice/a.jpg', type: 'image' }
			],
			mediaType: 'video',
			aspectRatio: '4:5',
			postType: 'story'
		});

		const removed = await call(editPost as Handler, {
			id: 'a-1',
			userId: 'alice',
			method: 'PATCH',
			body: { mediaUrls: [] }
		});
		expect(((await removed.json()) as { post: { mediaItems: unknown[] } }).post.mediaItems).toEqual(
			[]
		);
	});

	it('rejects media the author did not upload', async () => {
		for (const url of [
			'https://evil.test/pixel.gif',
			'https://evil.test/posts/alice/pixel.gif',
			'/api/media/posts/alice/../bob/b.jpg',
			'/api/media/posts/bob/b.jpg'
		]) {
			const res = await call(editPost as Handler, {
				id: 'a-1',
				userId: 'alice',
				method: 'PATCH',
				body: { mediaUrls: [{ url }] }
			});
			expect(res.status).toBe(400);
		}
	});

	it('forbids editing or deleting someone else’s post and rejects empty content', async () => {
		const edit = await call(editPost as Handler, {
			id: 'a-1',
			userId: 'bob',
			method: 'PATCH',
			body: { content: 'hijack' }
		});
		expect(edit.status).toBe(403);
		const del = await call(deletePost as Handler, { id: 'a-1', userId: 'bob', method: 'DELETE' });
		expect(del.status).toBe(403);

		const empty = await call(editPost as Handler, {
			id: 'a-1',
			userId: 'alice',
			method: 'PATCH',
			body: { content: '   ' }
		});
		expect(empty.status).toBe(400);
		const deleted = await call(editPost as Handler, {
			id: 'a-3',
			userId: 'alice',
			method: 'PATCH',
			body: { content: 'revive' }
		});
		expect(deleted.status).toBe(404);
	});

	it('deleting a post removes it from the profile count', async () => {
		const res = await call(deletePost as Handler, { id: 'a-2', userId: 'alice', method: 'DELETE' });
		expect(res.status).toBe(204);
		const stats = await loadProfileStats(db, 'alice');
		expect(stats.postsCount).toBe(1);
		expect(stats.impressionsCount).toBe(10);
	});
});
