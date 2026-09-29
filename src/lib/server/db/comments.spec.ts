import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { commentReaction, post, postComment, user } from './schema';
import {
	GET as listComments,
	POST as createComment
} from '../../../routes/api/posts/[id]/comments/+server';
import { GET as listReplies } from '../../../routes/api/comments/[id]/replies/+server';
import { DELETE as deleteComment } from '../../../routes/api/comments/[id]/+server';
import { POST as toggleReaction } from '../../../routes/api/comments/[id]/reactions/+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Handler = (event: never) => Promise<Response>;

let db: Db;
let dispose: () => Promise<void>;

// alice owns post p-1; bob and carol comment on it.
beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.batch([
		db.insert(user).values({ id: 'alice', name: 'Alice', email: 'a@test.dev', handle: 'alice' }),
		db.insert(user).values({ id: 'bob', name: 'Bob', email: 'b@test.dev' }),
		db.insert(user).values({ id: 'carol', name: 'Carol', email: 'c@test.dev' })
	]);
}, 60_000);

afterAll(() => dispose?.());

beforeEach(async () => {
	await db.delete(post);
	await db.batch([
		db.insert(post).values({ id: 'p-1', userId: 'alice', content: 'hello' }),
		db.insert(post).values({ id: 'p-2', userId: 'alice', content: 'other' })
	]);
});

function call(
	handler: unknown,
	{
		id,
		userId = null,
		body,
		search = ''
	}: { id: string; userId?: string | null; body?: unknown; search?: string }
): Promise<Response> {
	const url = new URL(`http://localhost/x${search}`);
	const event = {
		params: { id },
		url,
		locals: { db, user: userId ? { id: userId, name: userId, handle: null, image: null } : null },
		request: new Request(url, {
			method: body === undefined ? 'GET' : 'POST',
			headers: { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		})
	};
	return (handler as Handler)(event as never);
}

async function comment(userId: string, content: string, parentCommentId?: string, postId = 'p-1') {
	const res = await call(createComment, {
		id: postId,
		userId,
		body: { content, parentCommentId }
	});
	expect(res.status).toBe(201);
	return (await res.json()) as {
		comment: { id: string; parentCommentId: string | null };
		commentsCount: number;
		repliesCount: number | null;
	};
}

const postRow = async (id = 'p-1') => (await db.select().from(post).where(eq(post.id, id)))[0];
const commentRow = async (id: string) =>
	(await db.select().from(postComment).where(eq(postComment.id, id)))[0];

describe('nested comments on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	it('creates replies one level deep and keeps both counters exact', async () => {
		const top = await comment('bob', 'nice');
		expect(top.commentsCount).toBe(1);
		expect(top.repliesCount).toBeNull();

		const reply = await comment('carol', 'agreed', top.comment.id);
		expect(reply.comment.parentCommentId).toBe(top.comment.id);
		expect(reply.commentsCount).toBe(2);
		expect(reply.repliesCount).toBe(1);
		expect((await commentRow(top.comment.id)).repliesCount).toBe(1);

		// A reply to a reply is rejected, and nothing is written.
		const nested = await call(createComment, {
			id: 'p-1',
			userId: 'bob',
			body: { content: 'deeper', parentCommentId: reply.comment.id }
		});
		expect(nested.status).toBe(400);
		expect((await postRow()).commentsCount).toBe(2);
	});

	it('404s a parent that belongs to another post or does not exist', async () => {
		const other = await comment('bob', 'on p-2', undefined, 'p-2');
		for (const parentCommentId of [other.comment.id, 'missing']) {
			const res = await call(createComment, {
				id: 'p-1',
				userId: 'bob',
				body: { content: 'x', parentCommentId }
			});
			expect(res.status).toBe(404);
		}
	});

	it('404s comments on a deleted post', async () => {
		await db.update(post).set({ deletedAt: new Date() }).where(eq(post.id, 'p-1'));
		const res = await call(createComment, { id: 'p-1', userId: 'bob', body: { content: 'x' } });
		expect(res.status).toBe(404);
		expect((await call(listComments, { id: 'p-1' })).status).toBe(404);
	});

	it('lists top-level only, with repliesCount, and loads replies on demand', async () => {
		const first = await comment('bob', 'first');
		await comment('carol', 'reply 1', first.comment.id);
		await comment('alice', 'reply 2', first.comment.id);
		await comment('carol', 'second');

		const res = await call(listComments, { id: 'p-1', userId: 'bob' });
		const page = (await res.json()) as {
			comments: Array<{ content: string; repliesCount: number; canDelete: boolean }>;
		};
		expect(page.comments.map((c) => c.content)).toEqual(['first', 'second']);
		expect(page.comments.map((c) => c.repliesCount)).toEqual([2, 0]);
		// bob can delete his own comment but not carol's.
		expect(page.comments.map((c) => c.canDelete)).toEqual([true, false]);

		const replies = (await (await call(listReplies, { id: first.comment.id })).json()) as {
			comments: Array<{ content: string }>;
		};
		expect(replies.comments.map((c) => c.content)).toEqual(['reply 1', 'reply 2']);
	});

	it('pages with a cursor without repeats or gaps', async () => {
		const ids: string[] = [];
		for (let i = 0; i < 5; i++) ids.push((await comment('bob', `c${i}`)).comment.id);

		const seen: string[] = [];
		let cursor: string | null = null;
		do {
			const search: string = `?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
			const page = (await (await call(listComments, { id: 'p-1', search })).json()) as {
				comments: Array<{ id: string }>;
				nextCursor: string | null;
			};
			seen.push(...page.comments.map((c) => c.id));
			cursor = page.nextCursor;
		} while (cursor);
		expect(seen).toEqual(ids);

		expect((await call(listComments, { id: 'p-1', search: '?cursor=junk' })).status).toBe(400);
		expect((await call(listComments, { id: 'p-1', search: '?limit=500' })).status).toBe(400);
	});

	it('deleting a parent removes its replies and reactions and fixes the counts', async () => {
		const top = await comment('bob', 'top');
		const reply = await comment('carol', 'reply', top.comment.id);
		await comment('carol', 'stays');
		await call(toggleReaction, { id: reply.comment.id, userId: 'bob', body: { type: 'love' } });

		const res = await call(deleteComment, { id: top.comment.id, userId: 'bob' });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			commentsCount: 1,
			parentCommentId: null,
			repliesCount: null
		});
		expect(await commentRow(reply.comment.id)).toBeUndefined();
		expect(await db.select().from(commentReaction)).toEqual([]);
		expect((await postRow()).commentsCount).toBe(1);
	});

	it('deleting a reply updates the parent repliesCount', async () => {
		const top = await comment('bob', 'top');
		const reply = await comment('carol', 'reply', top.comment.id);
		const res = await call(deleteComment, { id: reply.comment.id, userId: 'carol' });
		expect(await res.json()).toEqual({
			commentsCount: 1,
			parentCommentId: top.comment.id,
			repliesCount: 0
		});
	});

	it('lets the post author delete any comment, and nobody else', async () => {
		const top = await comment('bob', 'top');
		expect((await call(deleteComment, { id: top.comment.id })).status).toBe(401);
		expect((await call(deleteComment, { id: top.comment.id, userId: 'carol' })).status).toBe(403);
		expect((await call(deleteComment, { id: top.comment.id, userId: 'alice' })).status).toBe(200);
		expect((await call(deleteComment, { id: top.comment.id, userId: 'alice' })).status).toBe(404);
	});
});

describe('comment reactions on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	async function react(commentId: string, userId: string, type: string) {
		const res = await call(toggleReaction, { id: commentId, userId, body: { type } });
		return { status: res.status, body: (await res.json()) as Record<string, unknown> };
	}

	it('toggling twice returns to the original state', async () => {
		const { comment: c } = await comment('bob', 'react to me');

		const on = await react(c.id, 'carol', 'fire');
		expect(on.body).toEqual({ reacted: true, reactions: { counts: { fire: 1 }, mine: ['fire'] } });
		expect((await commentRow(c.id)).reactionsCount).toBe(1);

		const off = await react(c.id, 'carol', 'fire');
		expect(off.body).toEqual({ reacted: false, reactions: { counts: {}, mine: [] } });
		expect((await commentRow(c.id)).reactionsCount).toBe(0);
	});

	it('aggregates counts per type and marks only the viewer’s own', async () => {
		const { comment: c } = await comment('bob', 'popular');
		await react(c.id, 'alice', 'love');
		await react(c.id, 'bob', 'love');
		await react(c.id, 'carol', 'haha');
		// One user may hold several different types.
		const last = await react(c.id, 'carol', 'love');
		expect(last.body.reactions).toEqual({ counts: { love: 3, haha: 1 }, mine: ['love', 'haha'] });

		const page = (await (await call(listComments, { id: 'p-1', userId: 'alice' })).json()) as {
			comments: Array<{ reactions: unknown }>;
		};
		expect(page.comments[0].reactions).toEqual({ counts: { love: 3, haha: 1 }, mine: ['love'] });
		expect((await commentRow(c.id)).reactionsCount).toBe(4);
	});

	it('concurrent double taps still cancel out', async () => {
		const { comment: c } = await comment('bob', 'race');
		await Promise.all([react(c.id, 'carol', 'wow'), react(c.id, 'carol', 'wow')]);
		expect(await db.select().from(commentReaction)).toEqual([]);
		expect((await commentRow(c.id)).reactionsCount).toBe(0);
	});

	it('rejects unknown types, anonymous users and missing comments', async () => {
		const { comment: c } = await comment('bob', 'x');
		expect((await react(c.id, 'carol', 'angry')).status).toBe(400);
		expect((await call(toggleReaction, { id: c.id, body: { type: 'like' } })).status).toBe(401);
		expect((await react('missing', 'carol', 'like')).status).toBe(404);
	});
});
