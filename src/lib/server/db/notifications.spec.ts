import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { notification, notificationRead, post, user, userFollow } from './schema';
import {
	NOTIFICATION_RETENTION_MS,
	countUnreadNotifications,
	listNotifications,
	markNotificationsRead
} from './notifications';
import { createComment, deleteComment, toggleReaction } from './comments';
import { setFollowing } from './follows';
import { POST as like } from '../../../routes/api/posts/[id]/like/+server';
import { GET as listApi } from '../../../routes/api/notifications/+server';
import { POST as readApi } from '../../../routes/api/notifications/read/+server';
import { GET as badgesApi } from '../../../routes/api/badges/+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Handler = (event: never) => Promise<Response>;

let db: Db;
let dispose: () => Promise<void>;

type Person = 'alice' | 'bob' | 'carol';

// alice owns p-1; bob and carol act on it.
beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.batch([
		db.insert(user).values({ id: 'alice', name: 'Alice', email: 'a@test.dev', handle: 'alice' }),
		db.insert(user).values({ id: 'bob', name: 'Bob', email: 'b@test.dev', handle: 'bob' }),
		db.insert(user).values({ id: 'carol', name: 'Carol', email: 'c@test.dev' })
	]);
}, 60_000);

afterAll(() => dispose?.());

beforeEach(async () => {
	await db.batch([
		db.delete(post),
		db.delete(notification),
		db.delete(notificationRead),
		db.delete(userFollow)
	]);
	await db.insert(post).values({ id: 'p-1', userId: 'alice', content: 'hello' });
});

const author = (id: Person) => ({ id, name: id, handle: null, image: null });

function call(
	handler: unknown,
	{
		id = '',
		userId = null,
		body,
		search = ''
	}: { id?: string; userId?: string | null; body?: unknown; search?: string }
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

/** `type:actor` for each of the recipient's notifications, newest first. */
async function inbox(recipientId: string) {
	const { items } = await listNotifications(db, recipientId, { limit: 50 });
	return items.map((n) => `${n.type}:${n.actor.id}`);
}

const comment = (by: Person, parentCommentId?: string) =>
	createComment(db, { postId: 'p-1', author: author(by), content: `from ${by}`, parentCommentId });

describe('notifications on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	it('notifies the author of a like once, removes it on unlike, and ignores self-likes', async () => {
		expect((await call(like, { id: 'p-1', userId: 'bob' })).status).toBe(200);
		expect(await inbox('alice')).toEqual(['like:bob']);

		expect((await call(like, { id: 'p-1', userId: 'bob' })).status).toBe(200); // unlike
		expect(await inbox('alice')).toEqual([]);

		await call(like, { id: 'p-1', userId: 'bob' }); // like again: still one row
		await call(like, { id: 'p-1', userId: 'alice' }); // own post
		expect(await inbox('alice')).toEqual(['like:bob']);
	});

	it('notifies the post author of comments and the parent author of replies', async () => {
		const top = await comment('bob');
		expect(await inbox('alice')).toEqual(['comment:bob']);

		// carol replies to bob: bob gets a reply, alice (post author) a comment.
		await comment('carol', top.comment.id);
		expect(await inbox('bob')).toEqual(['reply:carol']);
		expect(await inbox('alice')).toEqual(['comment:carol', 'comment:bob']);

		// alice replies to bob on her own post: bob gets a reply, alice nothing.
		await comment('alice', top.comment.id);
		expect(await inbox('bob')).toEqual(['reply:alice', 'reply:carol']);
		expect(await inbox('alice')).toEqual(['comment:carol', 'comment:bob']);
	});

	it('notifies once when the replied-to comment belongs to the post author', async () => {
		const own = await comment('alice');
		await comment('bob', own.comment.id);
		expect(await inbox('alice')).toEqual(['reply:bob']);
	});

	it('drops comment notifications when the comment is deleted', async () => {
		const top = await comment('bob');
		await comment('carol', top.comment.id);
		await deleteComment(db, { commentId: top.comment.id, userId: 'bob' });
		expect(await inbox('alice')).toEqual([]);
		expect(await inbox('bob')).toEqual([]);
	});

	it('notifies once per reacting person and clears when their last reaction goes', async () => {
		const own = await comment('alice');
		const id = own.comment.id;
		await toggleReaction(db, { commentId: id, userId: 'bob', type: 'like' });
		await toggleReaction(db, { commentId: id, userId: 'bob', type: 'love' });
		expect(await inbox('alice')).toEqual(['reaction:bob']);

		await toggleReaction(db, { commentId: id, userId: 'bob', type: 'like' });
		expect(await inbox('alice')).toEqual(['reaction:bob']);
		await toggleReaction(db, { commentId: id, userId: 'bob', type: 'love' });
		expect(await inbox('alice')).toEqual([]);

		await toggleReaction(db, { commentId: id, userId: 'alice', type: 'like' });
		expect(await inbox('alice')).toEqual([]);
	});

	it('notifies on follow and removes it on unfollow', async () => {
		await setFollowing(db, 'bob', 'alice', true);
		await setFollowing(db, 'bob', 'alice', true);
		expect(await inbox('alice')).toEqual(['follow:bob']);
		await setFollowing(db, 'bob', 'alice', false);
		expect(await inbox('alice')).toEqual([]);
	});

	it('hides activity about a deleted post, from the list and the count', async () => {
		await call(like, { id: 'p-1', userId: 'bob' });
		await setFollowing(db, 'carol', 'alice', true);
		expect(await countUnreadNotifications(db, 'alice')).toBe(2);

		await db.update(post).set({ deletedAt: new Date() }).where(eq(post.id, 'p-1'));
		expect(await inbox('alice')).toEqual(['follow:carol']);
		expect(await countUnreadNotifications(db, 'alice')).toBe(1);
	});

	it('counts unread after the read marker, which only moves forward', async () => {
		await db.insert(notification).values([
			{
				id: 'n1',
				recipientId: 'alice',
				actorId: 'bob',
				type: 'follow',
				dedupeKey: 'k1',
				createdAt: new Date(1000)
			},
			{
				id: 'n2',
				recipientId: 'alice',
				actorId: 'carol',
				type: 'follow',
				dedupeKey: 'k2',
				createdAt: new Date(2000)
			}
		]);
		expect(await countUnreadNotifications(db, 'alice')).toBe(2);

		await markNotificationsRead(db, 'alice', new Date(1000), 3000);
		expect(await countUnreadNotifications(db, 'alice')).toBe(1);
		const { items } = await listNotifications(db, 'alice', { limit: 10 });
		expect(items.map((n) => [n.id, n.unread])).toEqual([
			['n2', true],
			['n1', false]
		]);

		// A stale tab marking an older point does not un-read anything.
		await markNotificationsRead(db, 'alice', new Date(2000), 3000);
		await markNotificationsRead(db, 'alice', new Date(500), 3000);
		expect(await countUnreadNotifications(db, 'alice')).toBe(0);
	});

	it('prunes notifications past the retention window when marking read', async () => {
		const now = 10 * NOTIFICATION_RETENTION_MS;
		await db.insert(notification).values([
			{
				id: 'old',
				recipientId: 'alice',
				actorId: 'bob',
				type: 'follow',
				dedupeKey: 'old',
				createdAt: new Date(now - NOTIFICATION_RETENTION_MS - 1)
			},
			{
				id: 'new',
				recipientId: 'alice',
				actorId: 'carol',
				type: 'follow',
				dedupeKey: 'new',
				createdAt: new Date(now - 1)
			}
		]);
		await markNotificationsRead(db, 'alice', new Date(now), now);
		const rows = await db.select({ id: notification.id }).from(notification);
		expect(rows.map((r) => r.id)).toEqual(['new']);
	});

	it('serves pages, badges and the read marker over the API', async () => {
		expect((await call(listApi, {})).status).toBe(401);
		expect((await call(badgesApi, {})).status).toBe(401);

		await call(like, { id: 'p-1', userId: 'bob' });
		await setFollowing(db, 'carol', 'alice', true);

		const first = await call(listApi, { userId: 'alice', search: '?limit=1' });
		const page1 = (await first.json()) as {
			items: Array<{ type: string; createdAt: number; actor: { slug: string; handle: string } }>;
			nextCursor: string;
		};
		expect(page1.items.map((i) => i.type)).toEqual(['follow']);
		expect(page1.items[0].actor).toMatchObject({ slug: 'carol', handle: '@carol' });

		const second = await call(listApi, {
			userId: 'alice',
			search: `?limit=1&cursor=${encodeURIComponent(page1.nextCursor)}`
		});
		const page2 = (await second.json()) as {
			items: Array<{ type: string; post: { id: string } }>;
			nextCursor: null;
		};
		expect(page2.items.map((i) => [i.type, i.post.id])).toEqual([['like', 'p-1']]);
		expect(page2.nextCursor).toBeNull();

		expect(await (await call(badgesApi, { userId: 'alice' })).json()).toEqual({
			messages: 0,
			activity: 2
		});
		const read = await call(readApi, { userId: 'alice', body: { upTo: page1.items[0].createdAt } });
		expect(read.status).toBe(200);
		expect(await (await call(badgesApi, { userId: 'alice' })).json()).toEqual({
			messages: 0,
			activity: 0
		});

		expect((await call(readApi, { userId: 'alice', body: { upTo: 'soon' } })).status).toBe(400);
	});
});
