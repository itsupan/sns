import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { account, session, user } from './auth-schema';
import {
	commentReaction,
	conversation,
	conversationMember,
	message,
	notification,
	post,
	postComment,
	postLike,
	postMedia,
	postSave,
	report,
	story,
	storyView,
	userBlock,
	userFollow
} from './schema';
import { deleteAccount } from './account';
import { DELETE as deleteRoute } from '../../../routes/api/account/+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
}, 60_000);

afterAll(() => dispose?.());

const now = () => new Date();

/**
 * `alice` owns a post with R2 and third-party media, an R2 avatar, and interacts with bob's post:
 * like, comment, a reply to bob's comment, a reaction. bob replied to alice's comment. alice
 * follows bob, carol follows alice, and alice and bob share a DM.
 */
async function seed(id: string, opts: { password?: string } = {}) {
	const bob = `${id}-bob`;
	const carol = `${id}-carol`;
	await db.batch([
		db.insert(user).values({
			id,
			name: id,
			email: `${id}@test.dev`,
			handle: id,
			image: `https://acc.r2.cloudflarestorage.com/bucket/avatars/${id}/me.jpg`,
			followingCount: 1,
			followersCount: 1
		}),
		db.insert(user).values({
			id: bob,
			name: bob,
			email: `${bob}@test.dev`,
			handle: bob,
			followersCount: 1
		}),
		db.insert(user).values({
			id: carol,
			name: carol,
			email: `${carol}@test.dev`,
			handle: carol,
			followingCount: 1
		}),
		db.insert(account).values({
			id: `${id}-acc`,
			accountId: id,
			providerId: opts.password ? 'credential' : 'google',
			userId: id,
			password: opts.password ? await hashPassword(opts.password) : null,
			updatedAt: now()
		}),
		db.insert(session).values({
			id: `${id}-s`,
			token: `${id}-token`,
			userId: id,
			expiresAt: new Date(Date.now() + 86_400_000),
			updatedAt: now()
		}),
		db.insert(post).values({ id: `${id}-p`, userId: id, content: 'mine' }),
		db.insert(post).values({
			id: `${bob}-p`,
			userId: bob,
			content: 'bob',
			likesCount: 1,
			commentsCount: 4
		}),
		db.insert(postMedia).values([
			{
				id: `${id}-m1`,
				postId: `${id}-p`,
				url: `/api/media/posts/${id}/one.jpg`,
				type: 'image',
				position: 0
			},
			{
				id: `${id}-m2`,
				postId: `${id}-p`,
				url: 'https://images.unsplash.com/photo-123',
				type: 'image',
				position: 1
			}
		]),
		db.insert(postLike).values({ id: `${id}-l`, postId: `${bob}-p`, userId: id }),
		db.insert(postSave).values({ postId: `${bob}-p`, userId: id }),
		// bob's own comment (stays), alice's reply to it, alice's comment and bob's reply to it.
		db.insert(postComment).values({
			id: `${bob}-c`,
			postId: `${bob}-p`,
			userId: bob,
			content: 'bob comment',
			repliesCount: 1,
			reactionsCount: 1
		}),
		db.insert(postComment).values({
			id: `${id}-r`,
			postId: `${bob}-p`,
			userId: id,
			content: 'reply',
			parentCommentId: `${bob}-c`
		}),
		db.insert(postComment).values({
			id: `${id}-c`,
			postId: `${bob}-p`,
			userId: id,
			content: 'nice',
			repliesCount: 1
		}),
		db.insert(postComment).values({
			id: `${bob}-r`,
			postId: `${bob}-p`,
			userId: bob,
			content: 'thanks',
			parentCommentId: `${id}-c`
		}),
		db.insert(commentReaction).values({ commentId: `${bob}-c`, userId: id, reactionType: 'heart' }),
		db.insert(userFollow).values({ followerId: id, followingId: bob }),
		db.insert(userFollow).values({ followerId: carol, followingId: id }),
		db.insert(conversation).values({ id: `${id}-dm`, dmKey: `${id}:${bob}` }),
		db.insert(conversationMember).values([
			{ conversationId: `${id}-dm`, userId: id },
			{ conversationId: `${id}-dm`, userId: bob }
		]),
		db.insert(message).values([
			{ id: `${id}-msg1`, conversationId: `${id}-dm`, senderId: id, content: 'hi' },
			{ id: `${id}-msg2`, conversationId: `${id}-dm`, senderId: bob, content: 'hey' }
		]),
		db.insert(notification).values({
			id: `${id}-n`,
			type: 'follow',
			actorId: carol,
			recipientId: id,
			dedupeKey: `${id}-n`
		})
	]);
	return { bob, carol };
}

function mockBucket() {
	return { delete: vi.fn<(keys: string[]) => Promise<void>>(async () => undefined) };
}

function callDelete(userId: string | null, body: unknown, env: Record<string, unknown> = {}) {
	return (deleteRoute as (e: never) => Promise<Response>)({
		locals: { db, user: userId ? { id: userId } : null },
		platform: { env },
		request: new Request('http://localhost/api/account', {
			method: 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: typeof body === 'string' ? body : JSON.stringify(body)
		})
	} as never);
}

const exists = async (id: string) =>
	(await db.select({ id: user.id }).from(user).where(eq(user.id, id))).length > 0;

describe('account deletion on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	it("deletes the user and their data, fixes other users' counters and removes R2 media", async () => {
		const { bob, carol } = await seed('alice');
		await db.batch([
			db.insert(userBlock).values({ blockerId: 'alice', blockedId: bob }),
			db.insert(userBlock).values({ blockerId: carol, blockedId: 'alice' }),
			db.insert(report).values({
				id: 'alice-r',
				reporterId: 'alice',
				targetType: 'post',
				targetId: `${bob}-p`,
				reason: 'spam'
			}),
			// alice's long-expired story still has media on R2; she watched bob's live one.
			db.insert(story).values({
				id: 'alice:1',
				userId: 'alice',
				mediaUrl: '/api/media/stories/alice/s.jpg',
				mediaType: 'image',
				createdAt: new Date(1),
				expiresAt: new Date(2)
			}),
			db.insert(story).values({
				id: `${bob}:1`,
				userId: bob,
				mediaUrl: `/api/media/stories/${bob}/s.jpg`,
				mediaType: 'image',
				viewsCount: 1,
				createdAt: now(),
				expiresAt: new Date(Date.now() + 86_400_000)
			}),
			db.insert(storyView).values({ storyId: `${bob}:1`, viewerId: 'alice' })
		]);
		const bucket = mockBucket();

		const result = await deleteAccount(db as never, { R2_BUCKET: bucket } as never, 'alice');

		expect(result?.failedKeys).toEqual([]);
		expect(bucket.delete).toHaveBeenCalledTimes(1);
		expect([...bucket.delete.mock.calls[0][0]].sort()).toEqual([
			'avatars/alice/me.jpg',
			'posts/alice/one.jpg',
			'stories/alice/s.jpg'
		]);

		expect(await exists('alice')).toBe(false);
		expect(await db.select().from(session).where(eq(session.userId, 'alice'))).toEqual([]);
		expect(await db.select().from(account).where(eq(account.userId, 'alice'))).toEqual([]);
		expect(await db.select().from(post).where(eq(post.userId, 'alice'))).toEqual([]);
		expect(await db.select().from(postMedia).where(eq(postMedia.postId, 'alice-p'))).toEqual([]);
		expect(await db.select().from(postComment).where(eq(postComment.userId, 'alice'))).toEqual([]);
		expect(await db.select().from(postSave).where(eq(postSave.userId, 'alice'))).toEqual([]);
		expect(await db.select().from(notification).where(eq(notification.id, 'alice-n'))).toEqual([]);
		// Blocks in both directions and the user's own reports go with the account.
		expect(
			await db
				.select()
				.from(userBlock)
				.where(inArray(userBlock.blockerId, ['alice', carol]))
		).toEqual([]);
		expect(await db.select().from(report).where(eq(report.reporterId, 'alice'))).toEqual([]);
		expect(await db.select().from(story).where(eq(story.userId, 'alice'))).toEqual([]);
		const [bobStory] = await db
			.select({ viewsCount: story.viewsCount })
			.from(story)
			.where(eq(story.id, `${bob}:1`));
		expect(bobStory).toEqual({ viewsCount: 0 });
		// The DM is gone, bob's side included; bob's account stays.
		expect(await db.select().from(conversation).where(eq(conversation.id, 'alice-dm'))).toEqual([]);
		expect(
			await db
				.select()
				.from(message)
				.where(inArray(message.id, ['alice-msg1', 'alice-msg2']))
		).toEqual([]);

		const people = await db
			.select({ id: user.id, followers: user.followersCount, following: user.followingCount })
			.from(user)
			.where(inArray(user.id, [bob, carol]));
		expect(people).toEqual(
			expect.arrayContaining([
				{ id: bob, followers: 0, following: 0 },
				{ id: carol, followers: 0, following: 0 }
			])
		);

		const [bobPost] = await db
			.select()
			.from(post)
			.where(eq(post.id, `${bob}-p`));
		// Left: bob's own comment only (alice's comment, her reply and bob's reply to her are gone).
		expect(bobPost).toMatchObject({ likesCount: 0, commentsCount: 1 });
		const [bobComment] = await db
			.select()
			.from(postComment)
			.where(eq(postComment.id, `${bob}-c`));
		expect(bobComment).toMatchObject({ repliesCount: 0, reactionsCount: 0 });
	});

	it('returns null for an unknown user', async () => {
		expect(await deleteAccount(db as never, undefined, 'nobody')).toBeNull();
	});

	it('still deletes the account when R2 fails', async () => {
		await seed('dave');
		const bucket = { delete: vi.fn(async () => Promise.reject(new Error('R2 down'))) };
		const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

		const result = await deleteAccount(db as never, { R2_BUCKET: bucket } as never, 'dave');

		expect(await exists('dave')).toBe(false);
		expect(result?.failedKeys.sort()).toEqual(['avatars/dave/me.jpg', 'posts/dave/one.jpg']);
		expect(error).toHaveBeenCalled();
		error.mockRestore();
	});
});

describe('DELETE /api/account', { timeout: REAL_D1_TIMEOUT }, () => {
	it('returns 401 when signed out', async () => {
		expect((await callDelete(null, { confirm: 'DELETE' })).status).toBe(401);
	});

	it('returns 400 when the confirmation is missing or wrong', async () => {
		await seed('erin');
		expect((await callDelete('erin', {})).status).toBe(400);
		expect((await callDelete('erin', { confirm: 'delete' })).status).toBe(400);
		expect((await callDelete('erin', 'not json')).status).toBe(400);
		expect(await exists('erin')).toBe(true);
	});

	it('returns 403 for a wrong or missing password on an email account', async () => {
		await seed('frank', { password: 'correct horse' });
		const wrong = await callDelete('frank', { confirm: 'DELETE', password: 'nope' });
		expect(wrong.status).toBe(403);
		expect(((await wrong.json()) as { error: { code: string } }).error.code).toBe(
			'invalid_password'
		);
		expect((await callDelete('frank', { confirm: 'DELETE' })).status).toBe(403);
		expect(await exists('frank')).toBe(true);
	});

	it('deletes an email account with the right password', async () => {
		await seed('gina', { password: 'correct horse' });
		const bucket = mockBucket();
		const res = await callDelete(
			'gina',
			{ confirm: 'DELETE', password: 'correct horse' },
			{ R2_BUCKET: bucket }
		);
		expect(res.status).toBe(204);
		expect(await exists('gina')).toBe(false);
		expect(bucket.delete).toHaveBeenCalledWith(
			expect.arrayContaining(['avatars/gina/me.jpg', 'posts/gina/one.jpg'])
		);
	});

	it('deletes a Google-only account with just the confirmation', async () => {
		await seed('hank');
		const res = await callDelete('hank', { confirm: 'DELETE' }, { R2_BUCKET: mockBucket() });
		expect(res.status).toBe(204);
		expect(await exists('hank')).toBe(false);
	});
});
