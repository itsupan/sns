import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import {
	commentReaction,
	conversation,
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
import { blockStatus, blockedUserIds, listBlockedUsers } from './blocks';
import { setFollowing } from './follows';
import { loadCommentPreviews, loadFeedPage } from './posts';
import { loadExplorePage, loadSuggestedCreators, loadTagPage } from './explore';
import { searchPosts, searchUsers, toFtsQuery } from './search';
import { createComment, listPostComments, toggleReaction } from './comments';
import { countUnreadNotifications, listNotifications, notifyStatement } from './notifications';
import { getOrCreateDm } from './chat';
import { DELETE as unblock, POST as block } from '../../../routes/api/users/[id]/block/+server';
import { POST as follow } from '../../../routes/api/users/[id]/follow/+server';
import { POST as startDm } from '../../../routes/api/conversations/+server';
import { POST as sendMessage } from '../../../routes/api/conversations/[id]/messages/+server';
import { POST as like } from '../../../routes/api/posts/[id]/like/+server';
import { PUT as save } from '../../../routes/api/posts/[id]/save/+server';
import { POST as share } from '../../../routes/api/posts/[id]/share/+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Handler = (event: never) => Promise<Response>;

let db: Db;
let dispose: () => Promise<void>;

// alice and bob are the pair that gets blocked; carol is a bystander.
beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.batch([
		db.insert(user).values({ id: 'alice', name: 'Alice', email: 'a@test.dev', handle: 'alice' }),
		db.insert(user).values({ id: 'bob', name: 'Bob', email: 'b@test.dev', handle: 'bob' }),
		db.insert(user).values({ id: 'carol', name: 'Carol', email: 'c@test.dev', handle: 'carol' })
	]);
}, 60_000);

afterAll(() => dispose?.());

beforeEach(async () => {
	await db.batch([
		db.delete(userBlock),
		db.delete(userFollow),
		db.delete(notification),
		db.delete(conversation),
		db.delete(post),
		db.delete(tag),
		db.update(user).set({ followersCount: 0, followingCount: 0 })
	]);
});

function call(
	handler: unknown,
	{
		id = '',
		userId = null,
		body,
		platform
	}: { id?: string; userId?: string | null; body?: Record<string, unknown>; platform?: unknown }
): Promise<Response> {
	const url = new URL('http://localhost/x');
	const event = {
		params: { id },
		url,
		request: new Request(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body ?? {})
		}),
		locals: { db, user: userId ? { id: userId, name: userId, handle: null, image: null } : null },
		platform
	};
	return (handler as Handler)(event as never);
}

const counts = async (id: string) => {
	const [row] = await db
		.select({ followers: user.followersCount, following: user.followingCount })
		.from(user)
		.where(eq(user.id, id));
	return row;
};

const followEdges = async () =>
	(await db.select().from(userFollow)).map((r) => `${r.followerId}->${r.followingId}`).sort();

describe('blocking users on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	it('blocks and unblocks idempotently', async () => {
		for (let i = 0; i < 2; i++) {
			const res = await call(block, { id: 'bob', userId: 'alice' });
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ blocked: true });
		}
		expect(await db.select().from(userBlock)).toHaveLength(1);
		expect(await blockStatus(db, 'alice', 'bob')).toEqual({ blocked: true, blockedBy: false });
		expect(await blockStatus(db, 'bob', 'alice')).toEqual({ blocked: false, blockedBy: true });
		expect((await listBlockedUsers(db, 'alice')).map((u) => u.id)).toEqual(['bob']);
		expect(await blockedUserIds(db, 'alice')).toEqual(['bob']);
		expect(await blockedUserIds(db, 'bob')).toEqual(['alice']);
		expect(await blockedUserIds(db, 'carol')).toEqual([]);

		for (let i = 0; i < 2; i++) {
			const res = await call(unblock, { id: 'bob', userId: 'alice' });
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ blocked: false });
		}
		expect(await db.select().from(userBlock)).toEqual([]);
		expect(await blockedUserIds(db, 'bob')).toEqual([]);
	});

	it('requires sign-in, another user and an existing target', async () => {
		expect((await call(block, { id: 'bob' })).status).toBe(401);
		expect((await call(block, { id: 'alice', userId: 'alice' })).status).toBe(400);
		expect((await call(block, { id: 'nobody', userId: 'alice' })).status).toBe(404);
		expect((await call(unblock, { id: 'nobody', userId: 'alice' })).status).toBe(404);
		expect(await db.select().from(userBlock)).toEqual([]);
	});

	it('removes follows both ways, their notifications, and recomputes counters', async () => {
		await setFollowing(db, 'alice', 'bob', true);
		await setFollowing(db, 'bob', 'alice', true);
		await setFollowing(db, 'carol', 'bob', true);
		await setFollowing(db, 'alice', 'carol', true);
		expect(await counts('bob')).toEqual({ followers: 2, following: 1 });

		await call(block, { id: 'bob', userId: 'alice' });

		expect(await followEdges()).toEqual(['alice->carol', 'carol->bob']);
		expect(await counts('alice')).toEqual({ followers: 0, following: 1 });
		expect(await counts('bob')).toEqual({ followers: 1, following: 0 });
		expect(await counts('carol')).toEqual({ followers: 1, following: 1 });
		const follows = await db
			.select({ actor: notification.actorId, recipient: notification.recipientId })
			.from(notification);
		expect(follows.sort((a, b) => a.actor.localeCompare(b.actor))).toEqual([
			{ actor: 'alice', recipient: 'carol' },
			{ actor: 'carol', recipient: 'bob' }
		]);
	});

	it('forbids following in either direction while blocked', async () => {
		await call(block, { id: 'bob', userId: 'alice' });
		expect((await call(follow, { id: 'bob', userId: 'alice' })).status).toBe(403);
		expect((await call(follow, { id: 'alice', userId: 'bob' })).status).toBe(403);
		expect(await followEdges()).toEqual([]);

		await call(unblock, { id: 'bob', userId: 'alice' });
		expect((await call(follow, { id: 'bob', userId: 'alice' })).status).toBe(200);
	});

	it('filters feed, explore, tags, search and suggestions both ways', async () => {
		await db.batch([
			db.insert(post).values({ id: 'pa', userId: 'alice', content: 'sunset alice' }),
			db.insert(post).values({ id: 'pb', userId: 'bob', content: 'sunset bob' }),
			db.insert(post).values({ id: 'pc', userId: 'carol', content: 'sunset carol' }),
			db.insert(tag).values({ id: 't', slug: 'sunset', name: 'Sunset' }),
			db.insert(postTag).values({ postId: 'pa', tagId: 't', position: 0 }),
			db.insert(postTag).values({ postId: 'pb', tagId: 't', position: 0 }),
			db.insert(postTag).values({ postId: 'pc', tagId: 't', position: 0 })
		]);
		await call(block, { id: 'bob', userId: 'alice' });

		const feedIds = async (viewerId: string | null) =>
			(await loadFeedPage(db, { limit: 10, viewerId })).rows.map((r) => r.post.id).sort();
		expect(await feedIds('alice')).toEqual(['pa', 'pc']);
		expect(await feedIds('bob')).toEqual(['pb', 'pc']);
		expect(await feedIds('carol')).toEqual(['pa', 'pb', 'pc']);
		expect(await feedIds(null)).toEqual(['pa', 'pb', 'pc']);

		const explore = async (viewerId: string) =>
			(await loadExplorePage(db, viewerId, { page: 0, pageSize: 10 })).ids.sort();
		expect(await explore('alice')).toEqual(['pc']);
		expect(await explore('bob')).toEqual(['pc']);

		const tagged = async (viewerId: string) =>
			(await loadTagPage(db, 'sunset', { limit: 10, viewerId })).ids.sort();
		expect(await tagged('alice')).toEqual(['pa', 'pc']);
		expect(await tagged('bob')).toEqual(['pb', 'pc']);

		const match = toFtsQuery('sunset')!;
		const postHits = async (viewerId: string) =>
			(await searchPosts(db, match, ['sunset'], 10, viewerId)).map((p) => p.id).sort();
		expect(await postHits('alice')).toEqual(['pa', 'pc']);
		expect(await postHits('bob')).toEqual(['pb', 'pc']);
		expect(await searchUsers(db, toFtsQuery('bob')!, 10, 'alice')).toEqual([]);
		expect(await searchUsers(db, toFtsQuery('alice')!, 10, 'bob')).toEqual([]);
		expect((await searchUsers(db, toFtsQuery('bob')!, 10, 'carol')).map((u) => u.id)).toEqual([
			'bob'
		]);

		const suggested = async (viewerId: string) =>
			(await loadSuggestedCreators(db, viewerId)).map((u) => u.id).sort();
		expect(await suggested('alice')).toEqual(['carol']);
		expect(await suggested('bob')).toEqual(['carol']);
	});

	it('hides comments from blocked users both ways', async () => {
		await db.insert(post).values({ id: 'pc', userId: 'carol', content: 'hello' });
		for (const id of ['alice', 'bob', 'carol']) {
			await createComment(db, {
				postId: 'pc',
				author: { id, name: id },
				content: `from ${id}`
			});
		}
		await call(block, { id: 'bob', userId: 'alice' });

		const authors = async (viewerId: string | null) =>
			(await listPostComments(db, { postId: 'pc', viewerId, limit: 10 })).comments
				.map((c) => c.author.id)
				.sort();
		expect(await authors('alice')).toEqual(['alice', 'carol']);
		expect(await authors('bob')).toEqual(['bob', 'carol']);
		expect(await authors(null)).toEqual(['alice', 'bob', 'carol']);
	});

	it('hides existing notifications and stores no new ones between a blocked pair', async () => {
		await db.insert(post).values({ id: 'pa', userId: 'alice', content: 'mine' });
		const like = (actorId: string) =>
			notifyStatement(db, { type: 'like', actorId, recipientId: 'alice', postId: 'pa' });
		await db.batch([like('bob'), like('carol')]);
		expect(await countUnreadNotifications(db, 'alice')).toBe(2);

		await call(block, { id: 'alice', userId: 'bob' });
		const actors = async () =>
			(await listNotifications(db, 'alice', { limit: 10 })).items.map((n) => n.actor.id);
		expect(await actors()).toEqual(['carol']);
		expect(await countUnreadNotifications(db, 'alice')).toBe(1);

		// A new action from the blocked user is not stored at all (trigger), without failing.
		await db.delete(notification);
		await db.batch([like('bob'), like('carol')]);
		const stored = await db.select({ actor: notification.actorId }).from(notification);
		expect(stored).toEqual([{ actor: 'carol' }]);
	});

	it('forbids starting a conversation or sending a message while blocked', async () => {
		const dm = await getOrCreateDm(db, 'alice', 'bob');
		await call(block, { id: 'alice', userId: 'bob' });

		for (const [viewer, other] of [
			['alice', 'bob'],
			['bob', 'alice']
		]) {
			const start = await call(startDm, { userId: viewer, body: { userId: other } });
			expect(start.status).toBe(403);
			const send = await call(sendMessage, {
				id: dm.id,
				userId: viewer,
				body: { content: 'hi' }
			});
			expect(send.status).toBe(403);
		}
		await expect(getOrCreateDm(db, 'alice', 'bob')).rejects.toMatchObject({ status: 403 });

		await call(unblock, { id: 'alice', userId: 'bob' });
		expect(
			(await call(sendMessage, { id: dm.id, userId: 'alice', body: { content: 'hi' } })).status
		).toBe(201);
	});

	it('forbids liking, saving, sharing, commenting and reacting across a block', async () => {
		await db.batch([
			db.insert(post).values({ id: 'pa', userId: 'alice', content: 'alice post' }),
			db.insert(post).values({ id: 'pb', userId: 'bob', content: 'bob post' }),
			db.insert(postComment).values({ id: 'ca', postId: 'pb', userId: 'alice', content: 'hi' }),
			db.insert(postComment).values({ id: 'cc', postId: 'pa', userId: 'carol', content: 'hey' })
		]);
		await call(block, { id: 'alice', userId: 'bob' });

		for (const [viewer, postId] of [
			['bob', 'pa'],
			['alice', 'pb']
		]) {
			for (const handler of [like, save, share]) {
				expect((await call(handler, { id: postId, userId: viewer })).status).toBe(403);
			}
			await expect(
				createComment(db, { postId, author: { id: viewer, name: viewer }, content: 'yo' })
			).rejects.toMatchObject({ status: 403 });
		}
		await expect(
			createComment(db, {
				postId: 'pb',
				author: { id: 'bob', name: 'bob' },
				content: 'reply',
				parentCommentId: 'ca'
			})
		).rejects.toMatchObject({ status: 403 });
		// A blocked comment author, then a bystander's comment on the blocked user's post.
		for (const commentId of ['ca', 'cc']) {
			await expect(
				toggleReaction(db, { commentId, userId: 'bob', type: 'like' })
			).rejects.toMatchObject({ status: 403 });
		}

		expect(await db.select().from(postLike)).toEqual([]);
		expect(await db.select().from(postSave)).toEqual([]);
		expect(await db.select().from(commentReaction)).toEqual([]);
		const shares = await db.select({ n: post.sharesCount }).from(post);
		expect(shares.every((r) => r.n === 0)).toBe(true);

		await call(unblock, { id: 'alice', userId: 'bob' });
		expect((await call(like, { id: 'pa', userId: 'bob' })).status).toBe(200);
	});

	it('previews the newest visible top-level comment per post', async () => {
		const at = (min: number) => new Date(Date.UTC(2026, 0, 1, 0, min));
		await db.insert(post).values({ id: 'pc', userId: 'carol', content: 'hello' });
		await db.batch([
			db.insert(postComment).values({
				id: 'c1',
				postId: 'pc',
				userId: 'alice',
				content: 'first',
				createdAt: at(1)
			}),
			db.insert(postComment).values({
				id: 'c2',
				postId: 'pc',
				userId: 'bob',
				content: 'second',
				createdAt: at(2)
			}),
			db.insert(postComment).values({
				id: 'c3',
				postId: 'pc',
				userId: 'carol',
				content: 'a reply',
				parentCommentId: 'c1',
				createdAt: at(3)
			})
		]);
		await call(block, { id: 'alice', userId: 'bob' });

		expect((await loadCommentPreviews(db, 'carol', ['pc'])).get('pc')).toEqual({
			author: '@bob',
			content: 'second'
		});
		expect((await loadCommentPreviews(db, 'alice', ['pc'])).get('pc')).toEqual({
			author: '@alice',
			content: 'first'
		});
	});

	it('closes the pair’s live chat room when blocking', async () => {
		await getOrCreateDm(db, 'alice', 'bob');
		const closeAll = vi.fn(async () => {});
		const pending: Promise<unknown>[] = [];
		const platform = {
			env: {
				CHAT_ROOM: { idFromName: (name: string) => name, get: () => ({ closeAll }) }
			},
			ctx: { waitUntil: (p: Promise<unknown>) => pending.push(p) }
		};

		expect((await call(block, { id: 'bob', userId: 'alice', platform })).status).toBe(200);
		await Promise.all(pending);
		expect(closeAll).toHaveBeenCalledWith(4003, expect.any(String));

		closeAll.mockClear();
		await call(block, { id: 'carol', userId: 'alice', platform });
		expect(closeAll).not.toHaveBeenCalled();
	});
});
