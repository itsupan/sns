import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { account, session, user } from './auth-schema';
import {
	conversation,
	conversationMember,
	message,
	post,
	postComment,
	postLike,
	postMedia,
	postSave,
	userFollow
} from './schema';
import { buildAccountExport } from './account';
import { GET as exportData } from '../../../routes/api/account/export/+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	const now = new Date();
	await db.batch([
		db.insert(user).values({ id: 'alice', name: 'Alice', email: 'a@test.dev', handle: 'alice' }),
		db.insert(user).values({ id: 'bob', name: 'Bob', email: 'b@test.dev', handle: 'bob' }),
		db.insert(user).values({ id: 'carol', name: 'Carol', email: 'c@test.dev', handle: 'carol' }),
		db.insert(account).values({
			id: 'acc-a',
			accountId: 'alice',
			providerId: 'credential',
			userId: 'alice',
			password: 'hashed-secret',
			accessToken: 'oauth-secret',
			updatedAt: now
		}),
		db.insert(session).values({
			id: 's-a',
			token: 'session-secret',
			userId: 'alice',
			expiresAt: new Date(now.getTime() + 86_400_000),
			ipAddress: '203.0.113.7',
			userAgent: 'Firefox',
			updatedAt: now
		}),
		db.insert(post).values({ id: 'p-a', userId: 'alice', content: 'my post' }),
		db.insert(post).values({ id: 'p-b', userId: 'bob', content: 'bob post' }),
		db
			.insert(postMedia)
			.values({ id: 'm-1', postId: 'p-a', url: 'uploads/a.jpg', type: 'image', position: 0 }),
		db.insert(postComment).values({ id: 'c-1', postId: 'p-b', userId: 'alice', content: 'nice' }),
		db.insert(postLike).values({ id: 'l-1', postId: 'p-b', userId: 'alice' }),
		db.insert(postSave).values({ postId: 'p-b', userId: 'alice' }),
		db.insert(userFollow).values({ followerId: 'alice', followingId: 'bob' }),
		db.insert(userFollow).values({ followerId: 'carol', followingId: 'alice' }),
		db.insert(conversation).values({ id: 'cv-1', dmKey: 'alice:bob' }),
		db.insert(conversation).values({ id: 'cv-2', dmKey: 'bob:carol' }),
		db.insert(conversationMember).values({ conversationId: 'cv-1', userId: 'alice' }),
		db.insert(conversationMember).values({ conversationId: 'cv-1', userId: 'bob' }),
		db.insert(conversationMember).values({ conversationId: 'cv-2', userId: 'bob' }),
		db.insert(conversationMember).values({ conversationId: 'cv-2', userId: 'carol' }),
		db
			.insert(message)
			.values({ id: 'msg-1', conversationId: 'cv-1', senderId: 'alice', content: 'hi bob' }),
		db
			.insert(message)
			.values({ id: 'msg-2', conversationId: 'cv-1', senderId: 'bob', content: 'hi alice' }),
		db
			.insert(message)
			.values({ id: 'msg-3', conversationId: 'cv-2', senderId: 'bob', content: 'private' })
	]);
}, 60_000);

afterAll(() => dispose?.());

describe('account export on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	it("collects the user's own data and nothing else", async () => {
		const data = await buildAccountExport(db as never, 'alice');
		expect(data).not.toBeNull();
		expect(data!.profile).toMatchObject({ id: 'alice', email: 'a@test.dev', handle: 'alice' });
		expect(data!.posts.map((p) => p.id)).toEqual(['p-a']);
		expect(data!.posts[0].media).toEqual([{ url: 'uploads/a.jpg', type: 'image' }]);
		expect(data!.comments.map((c) => c.id)).toEqual(['c-1']);
		expect(data!.likes.map((l) => l.postId)).toEqual(['p-b']);
		expect(data!.saves.map((s) => s.postId)).toEqual(['p-b']);
		expect(data!.following).toMatchObject([{ userId: 'bob', handle: 'bob' }]);
		expect(data!.followers).toMatchObject([{ userId: 'carol', handle: 'carol' }]);
		expect(data!.sessions).toMatchObject([{ ipAddress: '203.0.113.7', userAgent: 'Firefox' }]);
		expect(data!.logins).toMatchObject([{ provider: 'credential' }]);

		// Only conversations alice is in; bob and carol's DM stays out.
		expect(data!.conversations.map((c) => c.id)).toEqual(['cv-1']);
		expect(data!.conversations[0].messages.map((m) => [m.content, m.mine])).toEqual(
			expect.arrayContaining([
				['hi bob', true],
				['hi alice', false]
			])
		);
	});

	it('never includes secrets', async () => {
		const text = JSON.stringify(await buildAccountExport(db as never, 'alice'));
		for (const secret of ['hashed-secret', 'oauth-secret', 'session-secret', 'private']) {
			expect(text).not.toContain(secret);
		}
	});

	it('serves a JSON attachment to the signed-in user only', async () => {
		const call = (userId: string | null) =>
			(exportData as (e: never) => Promise<Response>)({
				locals: { db, user: userId ? { id: userId } : null },
				platform: undefined
			} as never);

		expect((await call(null)).status).toBe(401);

		const res = await call('alice');
		expect(res.status).toBe(200);
		expect(res.headers.get('content-disposition')).toMatch(
			/^attachment; filename="kizuna-data-\d{4}-\d{2}-\d{2}\.json"$/
		);
		expect(((await res.json()) as { profile: { id: string } }).profile.id).toBe('alice');
	});
});
