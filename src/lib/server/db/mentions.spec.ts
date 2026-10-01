import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import type { ApiErrorBody } from '$lib/server/api';
import { notification, post, postLike, postMention, user, userBlock, userFollow } from './schema';
import { loadRecentLikers } from './posts';
import { POST as create } from '../../../routes/api/posts/+server';
import { PATCH as edit } from '../../../routes/api/posts/[id]/+server';
import { GET as suggest } from '../../../routes/api/users/suggest/+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Handler = (event: never) => Promise<Response>;

let db: Db;
let dispose: () => Promise<void>;

// alice writes; bob, carol and dave can be tagged; dave blocked alice.
beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.batch([
		db.insert(user).values({ id: 'alice', name: 'Alice', email: 'a@test.dev', handle: 'alice' }),
		db.insert(user).values({ id: 'bob', name: 'Bob', email: 'b@test.dev', handle: 'bob' }),
		db.insert(user).values({ id: 'carol', name: 'Carol', email: 'c@test.dev', handle: 'carol' }),
		db.insert(user).values({ id: 'dave', name: 'Dave', email: 'd@test.dev', handle: 'dave' }),
		db.insert(userBlock).values({ blockerId: 'dave', blockedId: 'alice' })
	]);
}, 60_000);

afterAll(() => dispose?.());

beforeEach(async () => {
	await db.delete(post);
});

function call(handler: Handler, userId: string, body: unknown, id?: string) {
	const event = {
		params: { id },
		url: new URL(`http://localhost/api/users/suggest?${new URLSearchParams(body as never)}`),
		locals: { db, user: { id: userId, name: userId, handle: userId } },
		platform: { env: {} },
		request: new Request('http://localhost/api/posts', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	};
	return (handler as (e: typeof event) => Promise<Response>)(event);
}

async function publish(body: Record<string, unknown>) {
	const res = await call(create as Handler, 'alice', body);
	return { res, post: ((await res.clone().json()) as { post: { id: string } }).post };
}

const mentionsOf = async (postId: string) =>
	(
		await db
			.select({ userId: postMention.userId })
			.from(postMention)
			.where(eq(postMention.postId, postId))
	)
		.map((m) => m.userId)
		.sort();

const mentionNotices = async () =>
	(
		await db
			.select({ recipientId: notification.recipientId })
			.from(notification)
			.where(eq(notification.type, 'mention'))
	)
		.map((n) => n.recipientId)
		.sort();

describe('tagging people in posts', { timeout: REAL_D1_TIMEOUT }, () => {
	it('tags and notifies known people, skipping yourself, unknown handles and blocks', async () => {
		const { res, post: created } = await publish({
			content: 'With @bob, @Carol, @alice, @nobody and @dave'
		});
		expect(res.status).toBe(201);
		expect(await mentionsOf(created.id)).toEqual(['bob', 'carol']);
		expect(await mentionNotices()).toEqual(['bob', 'carol']);
	});

	it('editing the text adds and removes tags with their notifications', async () => {
		const { post: created } = await publish({ content: 'Hi @bob' });
		const res = await call(edit as Handler, 'alice', { content: 'Hi @carol' }, created.id);
		expect(res.status).toBe(200);
		expect(await mentionsOf(created.id)).toEqual(['carol']);
		expect(await mentionNotices()).toEqual(['carol']);

		// Edits that leave the text alone keep the tags.
		await call(edit as Handler, 'alice', { location: 'Kyoto' }, created.id);
		expect(await mentionsOf(created.id)).toEqual(['carol']);
	});

	it('caps the number of people in one post', async () => {
		const content = Array.from({ length: 21 }, (_, i) => `@user${i}`).join(' ');
		const { res } = await publish({ content });
		expect(res.status).toBe(400);
		expect(((await res.json()) as ApiErrorBody).error.fields?.content).toMatch(/at most 20/);
	});
});

describe('text posts', { timeout: REAL_D1_TIMEOUT }, () => {
	it('stores the background and returns it with the post', async () => {
		const { res, post: created } = await publish({
			content: 'Good morning!',
			postType: 'text',
			background: 'ocean'
		});
		expect(res.status).toBe(201);
		expect(created).toMatchObject({ postType: 'text', background: 'ocean' });
		const [row] = await db.select().from(post).where(eq(post.id, created.id));
		expect(row).toMatchObject({ postType: 'text', background: 'ocean' });
	});

	it.each([
		['background', { background: 'neon' }],
		['mediaUrls', { background: 'ocean', mediaUrls: [{ url: '/api/media/posts/alice/a.jpg' }] }],
		['content', { background: 'ocean', content: 'x'.repeat(281) }]
	])('rejects an invalid %s', async (field, extra) => {
		const { res } = await publish({ content: 'Hello', postType: 'text', ...extra });
		expect(res.status).toBe(400);
		expect(((await res.json()) as ApiErrorBody).error.fields?.[field]).toBeDefined();
	});

	it('keeps text-post rules on edit and clears the background when it stops being one', async () => {
		const { post: created } = await publish({
			content: 'Short',
			postType: 'text',
			background: 'sunset'
		});
		const tooLong = await call(edit as Handler, 'alice', { content: 'x'.repeat(281) }, created.id);
		expect(tooLong.status).toBe(400);

		const recolored = await call(edit as Handler, 'alice', { background: 'grape' }, created.id);
		expect(((await recolored.json()) as { post: { background: string } }).post.background).toBe(
			'grape'
		);

		await call(edit as Handler, 'alice', { postType: 'photo' }, created.id);
		const [row] = await db.select().from(post).where(eq(post.id, created.id));
		expect(row).toMatchObject({ postType: 'photo', background: null });
	});
});

describe('GET /api/users/suggest', { timeout: REAL_D1_TIMEOUT }, () => {
	const handles = async (q: string) => {
		const res = await call(suggest as Handler, 'alice', { q });
		expect(res.status).toBe(200);
		return ((await res.json()) as { users: { handle: string }[] }).users.map((u) => u.handle);
	};

	it('matches handle prefixes, people you follow first, never you or blocked users', async () => {
		await db.insert(userFollow).values({ followerId: 'alice', followingId: 'carol' });
		try {
			expect(await handles('')).toEqual(['carol', 'bob']);
			expect(await handles('@B')).toEqual(['bob']);
			expect(await handles('al')).toEqual([]);
			expect(await handles('da')).toEqual([]);
			expect(await handles('<x>')).toEqual([]);
		} finally {
			await db.delete(userFollow).where(eq(userFollow.followerId, 'alice'));
		}
	});
});

describe('loadRecentLikers', { timeout: REAL_D1_TIMEOUT }, () => {
	it('names the latest liker other than the viewer', async () => {
		const { post: created } = await publish({ content: 'Like me' });
		await db.insert(postLike).values([
			{ id: 'l1', postId: created.id, userId: 'bob', createdAt: new Date(1000) },
			{ id: 'l2', postId: created.id, userId: 'carol', createdAt: new Date(2000) }
		]);
		expect((await loadRecentLikers(db, 'bob', [created.id])).get(created.id)).toBe('Carol');
		expect((await loadRecentLikers(db, 'carol', [created.id])).get(created.id)).toBe('Bob');
		expect((await loadRecentLikers(db, null, ['missing'])).size).toBe(0);
	});
});
