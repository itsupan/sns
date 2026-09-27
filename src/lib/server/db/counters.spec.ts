import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { count, eq } from 'drizzle-orm';
import { createTestDb } from '$lib/server/testing/d1';
import { post, postComment, postLike, user } from './schema';
import { POST as toggleLike } from '../../../routes/api/posts/[id]/like/+server';
import { POST as sharePost } from '../../../routes/api/posts/[id]/share/+server';
import { POST as createComment } from '../../../routes/api/posts/[id]/comments/+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Handler = (event: never) => Promise<Response>;

let db: Db;
let dispose: () => Promise<void>;
const USERS = Array.from({ length: 20 }, (_, i) => `u-${i}`);

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.insert(user).values(USERS.map((id) => ({ id, name: id, email: `${id}@test.dev` })));
	await db.insert(post).values({ id: 'p-1', userId: 'u-0', content: 'hello' });
}, 60_000);

afterAll(() => dispose?.());

function call(handler: Handler, userId: string | null, body?: unknown) {
	const event = {
		params: { id: 'p-1' },
		locals: { db, user: userId ? { id: userId, name: userId } : null },
		request: new Request('http://localhost', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body ?? {})
		})
	};
	return (handler as (e: typeof event) => Promise<Response>)(event);
}

async function counters() {
	const [row] = await db.select().from(post).where(eq(post.id, 'p-1'));
	const [likes] = await db.select({ n: count() }).from(postLike).where(eq(postLike.postId, 'p-1'));
	const [comments] = await db
		.select({ n: count() })
		.from(postComment)
		.where(eq(postComment.postId, 'p-1'));
	return { row, likeRows: likes.n, commentRows: comments.n };
}

describe('counters on real D1', () => {
	it('returns the new like state and count', async () => {
		const liked = await call(toggleLike as Handler, 'u-0');
		expect(await liked.json()).toEqual({ liked: true, likesCount: 1 });
		const unliked = await call(toggleLike as Handler, 'u-0');
		expect(await unliked.json()).toEqual({ liked: false, likesCount: 0 });
	});

	it('returns the created comment and new count', async () => {
		const res = await call(createComment as Handler, 'u-0', { content: '  first  ' });
		expect(res.status).toBe(201);
		const data = (await res.json()) as { comment: { content: string }; commentsCount: number };
		expect(data.comment.content).toBe('first');
		expect(data.commentsCount).toBe(1);
		await db.delete(postComment);
		await db.update(post).set({ commentsCount: 0 }).where(eq(post.id, 'p-1'));
	});

	it('keeps likes_count equal to like rows under parallel likes', async () => {
		const results = await Promise.all(USERS.map((id) => call(toggleLike as Handler, id)));
		expect(results.every((r) => r.status === 200)).toBe(true);

		const { row, likeRows } = await counters();
		expect(likeRows).toBe(USERS.length);
		expect(row.likesCount).toBe(likeRows);
	});

	it('keeps likes_count correct under parallel unlikes', async () => {
		await Promise.all(USERS.slice(0, 7).map((id) => call(toggleLike as Handler, id)));
		const { row, likeRows } = await counters();
		expect(likeRows).toBe(USERS.length - 7);
		expect(row.likesCount).toBe(likeRows);
	});

	it('does not fail or double count when one user double-clicks like', async () => {
		const before = (await counters()).likeRows;
		const results = await Promise.all([
			call(toggleLike as Handler, 'u-0'),
			call(toggleLike as Handler, 'u-0')
		]);
		expect(results.every((r) => r.status === 200)).toBe(true);
		const { row, likeRows } = await counters();
		expect([before - 1, before, before + 1]).toContain(likeRows);
		expect(row.likesCount).toBe(likeRows);
	});

	it('self-heals a drifted likes_count on the next toggle', async () => {
		await db.update(post).set({ likesCount: 999 }).where(eq(post.id, 'p-1'));
		await call(toggleLike as Handler, 'u-19');
		const { row, likeRows } = await counters();
		expect(row.likesCount).toBe(likeRows);
	});

	it('keeps comments_count equal to comment rows under parallel comments', async () => {
		await Promise.all(
			USERS.map((id) => call(createComment as Handler, id, { content: `hi from ${id}` }))
		);
		const { row, commentRows } = await counters();
		expect(commentRows).toBe(USERS.length);
		expect(row.commentsCount).toBe(commentRows);
	});

	it('does not lose parallel shares', async () => {
		const before = (await counters()).row.sharesCount;
		await Promise.all(USERS.map(() => call(sharePost as Handler, null)));
		expect((await counters()).row.sharesCount).toBe(before + USERS.length);
	});
});
