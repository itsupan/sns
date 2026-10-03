import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { fakeRateLimiter } from '$lib/server/testing/rate-limiter';
import {
	conversation,
	conversationMember,
	message,
	moderationAction,
	post,
	postComment,
	postMedia,
	report,
	session,
	user,
	type ReportReason,
	type ReportTargetType
} from '$lib/server/db/schema';
import { resolveReports, type QueueItem } from '$lib/server/db/moderation';
import { GET as queue } from './reports/+server';
import { POST as resolve } from './reports/resolve/+server';
import { GET as listModerators, POST as grant } from './moderators/+server';
import { DELETE as revoke } from './moderators/[id]/+server';
import { DELETE as unsuspend } from './users/[id]/suspension/+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Handler = (event: never) => Promise<Response>;

let db: Db;
let dispose: () => Promise<void>;

const ROLES: Record<string, string | null> = {
	boss: 'admin',
	mod: 'moderator',
	mod2: 'moderator',
	alice: null,
	bob: 'user',
	carol: 'user'
};

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.insert(user).values(
		Object.entries(ROLES).map(([id, role]) => ({
			id,
			name: id,
			email: `${id}@test.dev`,
			handle: id,
			role
		}))
	);
}, 60_000);

afterAll(() => dispose?.());

beforeEach(async () => {
	await db.batch([
		db.delete(moderationAction),
		db.delete(report),
		db.delete(session),
		db.delete(post),
		db.delete(conversation),
		...Object.entries(ROLES).map(([id, role]) =>
			db
				.update(user)
				.set({ role, banned: false, banReason: null, banExpires: null })
				.where(eq(user.id, id))
		)
	]);
});

function call(
	handler: Handler,
	{
		as,
		body,
		params = {},
		query = '',
		platform
	}: {
		as: string | null;
		body?: unknown;
		params?: Record<string, string>;
		query?: string;
		platform?: unknown;
	}
) {
	return handler({
		params,
		url: new URL(`http://localhost/api/admin${query}`),
		locals: { db, user: as ? { id: as, name: as, role: ROLES[as] } : null },
		platform,
		request: new Request('http://localhost', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body ?? {})
		})
	} as never);
}

let reportSeq = 0;
async function fileReport(
	targetType: ReportTargetType,
	targetId: string,
	reporterId: string,
	reason: ReportReason = 'spam',
	createdAt = new Date()
) {
	const id = `r-${++reportSeq}`;
	await db.insert(report).values({ id, reporterId, targetType, targetId, reason, createdAt });
	return id;
}

const resolveAs = (as: string, body: Record<string, unknown>) =>
	call(resolve as Handler, { as, body });

async function seedContent() {
	await db.batch([
		db.insert(post).values({ id: 'p-1', userId: 'alice', content: 'buy now', commentsCount: 2 }),
		db.insert(post).values({ id: 'p-mod', userId: 'mod2', content: 'mod post' }),
		db.insert(postMedia).values({
			id: 'm-1',
			postId: 'p-1',
			url: 'https://cdn.test/a.jpg',
			type: 'image',
			position: 0
		}),
		db.insert(postComment).values({
			id: 'c-1',
			postId: 'p-1',
			userId: 'bob',
			content: 'top',
			repliesCount: 1
		}),
		db.insert(postComment).values({
			id: 'c-2',
			postId: 'p-1',
			userId: 'alice',
			content: 'rude reply',
			parentCommentId: 'c-1'
		}),
		db.insert(conversation).values({ id: 'cv-1', dmKey: 'alice:bob' }),
		db.insert(conversationMember).values([
			{ conversationId: 'cv-1', userId: 'alice' },
			{ conversationId: 'cv-1', userId: 'bob' }
		]),
		db
			.insert(message)
			.values({ id: 'msg-1', conversationId: 'cv-1', senderId: 'alice', content: 'threat' }),
		db.insert(session).values({
			id: 's-alice',
			token: 'tok-alice',
			userId: 'alice',
			expiresAt: new Date(Date.now() + 86_400_000),
			updatedAt: new Date()
		})
	]);
}

const audit = () => db.select().from(moderationAction);
const reportsOn = (targetId: string) =>
	db.select().from(report).where(eq(report.targetId, targetId));

describe('/api/admin authorization', { timeout: REAL_D1_TIMEOUT }, () => {
	it('hides every admin route from signed-out users (401) and plain users (404)', async () => {
		const routes: [Handler, Record<string, string>][] = [
			[queue as Handler, {}],
			[resolve as Handler, {}],
			[listModerators as Handler, {}],
			[grant as Handler, {}],
			[revoke as Handler, { id: 'mod' }],
			[unsuspend as Handler, { id: 'alice' }]
		];
		for (const [handler, params] of routes) {
			expect((await call(handler, { as: null, params })).status).toBe(401);
			expect((await call(handler, { as: 'alice', params })).status).toBe(404);
			expect((await call(handler, { as: 'bob', params })).status).toBe(404);
		}
	});

	it('lets moderators work the queue but keeps role and suspension management for admins', async () => {
		expect((await call(queue as Handler, { as: 'mod' })).status).toBe(200);
		expect((await call(listModerators as Handler, { as: 'mod' })).status).toBe(403);
		expect((await call(grant as Handler, { as: 'mod', body: { user: 'bob' } })).status).toBe(403);
		expect((await call(revoke as Handler, { as: 'mod', params: { id: 'mod2' } })).status).toBe(403);
		expect((await call(unsuspend as Handler, { as: 'mod', params: { id: 'alice' } })).status).toBe(
			403
		);
		expect((await call(queue as Handler, { as: 'boss' })).status).toBe(200);
		expect((await call(listModerators as Handler, { as: 'boss' })).status).toBe(200);
	});

	it('rate-limits moderators under the moderation limit', async () => {
		const limiter = fakeRateLimiter();
		limiter.exhaust('moderation', 'mod');
		const platform = { env: { RATE_LIMITER: limiter.namespace } };
		expect((await call(queue as Handler, { as: 'mod', platform })).status).toBe(429);
	});
});

describe('GET /api/admin/reports', { timeout: REAL_D1_TIMEOUT }, () => {
	it('groups open reports by target with counts, reasons and a preview, newest first', async () => {
		await seedContent();
		const t = (ms: number) => new Date(1_700_000_000_000 + ms);
		await fileReport('post', 'p-1', 'bob', 'spam', t(1));
		await fileReport('post', 'p-1', 'carol', 'hate', t(5));
		await fileReport('comment', 'c-2', 'bob', 'harassment', t(4));
		await fileReport('user', 'alice', 'carol', 'impersonation', t(3));
		await fileReport('message', 'msg-1', 'bob', 'violence', t(2));
		const closed = await fileReport('post', 'p-mod', 'bob', 'spam', t(9));
		await db.update(report).set({ status: 'dismissed' }).where(eq(report.id, closed));

		const first = await call(queue as Handler, { as: 'mod', query: '?limit=3' });
		expect(first.status).toBe(200);
		const page1 = (await first.json()) as { items: QueueItem[]; nextCursor: string };
		expect(page1.items.map((i) => [i.targetType, i.targetId, i.reportCount])).toEqual([
			['post', 'p-1', 2],
			['comment', 'c-2', 1],
			['user', 'alice', 1]
		]);
		expect(page1.items[0]).toMatchObject({
			reasons: expect.arrayContaining(['spam', 'hate']),
			latestReportAt: t(5).toISOString(),
			target: {
				text: 'buy now',
				media: { url: 'https://cdn.test/a.jpg', type: 'image' },
				owner: { id: 'alice', role: 'user', banned: false }
			}
		});
		expect(page1.items[1].target).toMatchObject({ text: 'rude reply', postId: 'p-1' });
		expect(page1.items[2].target).toMatchObject({ owner: { id: 'alice', handle: 'alice' } });

		const second = await call(queue as Handler, {
			as: 'mod',
			query: `?limit=3&cursor=${encodeURIComponent(page1.nextCursor)}`
		});
		const page2 = (await second.json()) as { items: QueueItem[]; nextCursor: string | null };
		expect(page2.items.map((i) => i.targetId)).toEqual(['msg-1']);
		expect(page2.items[0].target).toMatchObject({ text: 'threat', owner: { id: 'alice' } });
		expect(page2.nextCursor).toBeNull();
	});

	it('keeps a report whose target is gone, with no preview', async () => {
		await fileReport('comment', 'c-gone', 'bob');
		const body = (await (await call(queue as Handler, { as: 'mod' })).json()) as {
			items: QueueItem[];
		};
		expect(body.items).toMatchObject([{ targetId: 'c-gone', target: null }]);
	});
});

describe('POST /api/admin/reports/resolve', { timeout: REAL_D1_TIMEOUT }, () => {
	it('dismisses every open report on the target and leaves the content', async () => {
		await seedContent();
		const newest = await fileReport('post', 'p-1', 'carol', 'spam', new Date(Date.now() + 1000));
		await fileReport('post', 'p-1', 'bob');

		const res = await resolveAs('mod', {
			targetType: 'post',
			targetId: 'p-1',
			action: 'dismiss',
			note: '  satire  '
		});
		expect(res.status).toBe(200);
		const reports = await reportsOn('p-1');
		expect(reports).toHaveLength(2);
		for (const r of reports) {
			expect(r).toMatchObject({ status: 'dismissed', resolution: 'dismissed', resolvedBy: 'mod' });
			expect(r.resolvedAt).toBeInstanceOf(Date);
		}
		expect(await audit()).toMatchObject([
			{
				moderatorId: 'mod',
				action: 'dismiss',
				targetType: 'post',
				targetId: 'p-1',
				reportId: newest,
				note: 'satire'
			}
		]);
		const [kept] = await db.select().from(post).where(eq(post.id, 'p-1'));
		expect(kept.deletedAt).toBeNull();

		// Nothing open is left to resolve.
		expect(
			(await resolveAs('mod', { targetType: 'post', targetId: 'p-1', action: 'dismiss' })).status
		).toBe(404);
	});

	it('removes a post by soft-deleting it', async () => {
		await seedContent();
		await fileReport('post', 'p-1', 'bob');
		const res = await resolveAs('mod', {
			targetType: 'post',
			targetId: 'p-1',
			action: 'remove_content'
		});
		expect(res.status).toBe(200);
		const [removed] = await db.select().from(post).where(eq(post.id, 'p-1'));
		expect(removed.deletedAt).toBeInstanceOf(Date);
		expect(await reportsOn('p-1')).toMatchObject([
			{ status: 'resolved', resolution: 'content_removed', resolvedBy: 'mod' }
		]);
		expect(await audit()).toMatchObject([
			{ action: 'remove_content', targetType: 'post', targetId: 'p-1' }
		]);
	});

	it('removes a reply and recounts its post and parent', async () => {
		await seedContent();
		await fileReport('comment', 'c-2', 'bob');
		const res = await resolveAs('mod', {
			targetType: 'comment',
			targetId: 'c-2',
			action: 'remove_content'
		});
		expect(res.status).toBe(200);
		expect(await db.select().from(postComment).where(eq(postComment.id, 'c-2'))).toEqual([]);
		const [parent] = await db.select().from(postComment).where(eq(postComment.id, 'c-1'));
		expect(parent.repliesCount).toBe(0);
		const [p] = await db.select().from(post).where(eq(post.id, 'p-1'));
		expect(p.commentsCount).toBe(1);
		expect(await audit()).toMatchObject([{ action: 'remove_content', targetType: 'comment' }]);
	});

	it('removes a message by soft-deleting it', async () => {
		await seedContent();
		await fileReport('message', 'msg-1', 'bob');
		const res = await resolveAs('mod', {
			targetType: 'message',
			targetId: 'msg-1',
			action: 'remove_content'
		});
		expect(res.status).toBe(200);
		const [m] = await db.select().from(message).where(eq(message.id, 'msg-1'));
		expect(m.deletedAt).toBeInstanceOf(Date);
		expect(await reportsOn('msg-1')).toMatchObject([{ resolution: 'content_removed' }]);
	});

	it('refuses to remove an account or content that is already gone', async () => {
		await seedContent();
		await fileReport('user', 'alice', 'bob');
		expect(
			(await resolveAs('mod', { targetType: 'user', targetId: 'alice', action: 'remove_content' }))
				.status
		).toBe(400);
		await fileReport('comment', 'c-gone', 'bob');
		expect(
			(
				await resolveAs('mod', {
					targetType: 'comment',
					targetId: 'c-gone',
					action: 'remove_content'
				})
			).status
		).toBe(404);
		expect(await audit()).toEqual([]);
	});

	it("suspends the owner for a duration, signs them out and closes the target's reports", async () => {
		await seedContent();
		await fileReport('message', 'msg-1', 'bob');
		const before = Date.now();
		const res = await resolveAs('mod', {
			targetType: 'message',
			targetId: 'msg-1',
			action: 'suspend_user',
			durationDays: 3,
			note: 'threats'
		});
		expect(res.status).toBe(200);
		const [alice] = await db.select().from(user).where(eq(user.id, 'alice'));
		expect(alice).toMatchObject({ banned: true, banReason: 'threats' });
		expect(alice.banExpires!.getTime()).toBeGreaterThanOrEqual(before + 3 * 86_400_000 - 1000);
		expect(await db.select().from(session).where(eq(session.userId, 'alice'))).toEqual([]);
		expect(await reportsOn('msg-1')).toMatchObject([
			{ status: 'resolved', resolution: 'user_suspended' }
		]);
		expect(await audit()).toMatchObject([
			{ action: 'suspend_user', targetType: 'user', targetId: 'alice', note: 'threats' }
		]);
	});

	it('suspends indefinitely without a duration', async () => {
		await seedContent();
		await fileReport('user', 'alice', 'bob');
		await resolveAs('mod', { targetType: 'user', targetId: 'alice', action: 'suspend_user' });
		const [alice] = await db.select().from(user).where(eq(user.id, 'alice'));
		expect(alice).toMatchObject({ banned: true, banExpires: null });
	});

	it('only lets a higher role act on a user, and nobody on themselves', async () => {
		await seedContent();
		await fileReport('post', 'p-mod', 'bob');
		await fileReport('user', 'boss', 'bob');
		await fileReport('user', 'mod', 'bob');

		for (const action of ['remove_content', 'suspend_user']) {
			expect(
				(await resolveAs('mod', { targetType: 'post', targetId: 'p-mod', action })).status
			).toBe(403);
		}
		expect(
			(await resolveAs('mod', { targetType: 'user', targetId: 'boss', action: 'suspend_user' }))
				.status
		).toBe(403);
		expect(
			(await resolveAs('mod', { targetType: 'user', targetId: 'mod', action: 'dismiss' })).status
		).toBe(403);
		expect(await audit()).toEqual([]);

		expect(
			(await resolveAs('boss', { targetType: 'post', targetId: 'p-mod', action: 'suspend_user' }))
				.status
		).toBe(200);
		const [mod2] = await db.select().from(user).where(eq(user.id, 'mod2'));
		expect(mod2.banned).toBe(true);
	});

	it('validates the action and duration', async () => {
		for (const body of [
			{ targetType: 'post', targetId: 'p-1', action: 'delete' },
			{ targetType: 'post', targetId: 'p-1', action: 'suspend_user', durationDays: 0 },
			{ targetType: 'post', targetId: 'p-1', action: 'suspend_user', durationDays: 1.5 }
		]) {
			expect((await resolveAs('mod', body)).status).toBe(400);
		}
	});

	it("keeps the audit trail and resolved reports when the moderator's account is deleted", async () => {
		await db
			.insert(user)
			.values({ id: 'temp-mod', name: 'Temp', email: 'temp@test.dev', role: 'moderator' });
		await fileReport('user', 'carol', 'bob');
		await resolveReports(db, {
			moderator: { id: 'temp-mod', role: 'moderator' },
			targetType: 'user',
			targetId: 'carol',
			action: 'dismiss',
			durationDays: null,
			note: null
		});
		await db.delete(user).where(eq(user.id, 'temp-mod'));
		expect(await audit()).toMatchObject([
			{ moderatorId: null, action: 'dismiss', targetId: 'carol' }
		]);
		expect(await reportsOn('carol')).toMatchObject([{ status: 'dismissed', resolvedBy: null }]);
	});
});

describe('admin-only routes', { timeout: REAL_D1_TIMEOUT }, () => {
	it('grants the moderator role by handle or id, lists staff, and revokes it', async () => {
		const granted = await call(grant as Handler, { as: 'boss', body: { user: '@bob' } });
		expect(granted.status).toBe(201);
		expect((await call(grant as Handler, { as: 'boss', body: { user: 'carol' } })).status).toBe(
			201
		);
		expect((await call(grant as Handler, { as: 'boss', body: { user: 'bob' } })).status).toBe(409);
		expect((await call(grant as Handler, { as: 'boss', body: { user: 'nobody' } })).status).toBe(
			404
		);

		const list = (await (await call(listModerators as Handler, { as: 'boss' })).json()) as {
			users: { id: string; role: string }[];
		};
		expect(list.users.map((u) => u.id).sort()).toEqual(['bob', 'boss', 'carol', 'mod', 'mod2']);

		expect((await call(revoke as Handler, { as: 'boss', params: { id: 'bob' } })).status).toBe(204);
		expect((await call(revoke as Handler, { as: 'boss', params: { id: 'alice' } })).status).toBe(
			409
		);
		const [bob] = await db.select().from(user).where(eq(user.id, 'bob'));
		expect(bob.role).toBe('user');

		expect((await audit()).map((a) => [a.action, a.targetId, a.moderatorId])).toEqual(
			expect.arrayContaining([
				['grant_moderator', 'bob', 'boss'],
				['grant_moderator', 'carol', 'boss'],
				['revoke_moderator', 'bob', 'boss']
			])
		);
		expect(await audit()).toHaveLength(3);
	});

	it('cannot promote or demote an admin, including themselves', async () => {
		expect((await call(grant as Handler, { as: 'boss', body: { user: 'boss' } })).status).toBe(403);
		expect((await call(revoke as Handler, { as: 'boss', params: { id: 'boss' } })).status).toBe(
			403
		);
	});

	it('lifts a suspension', async () => {
		await db.update(user).set({ banned: true, banReason: 'spam' }).where(eq(user.id, 'alice'));
		const res = await call(unsuspend as Handler, {
			as: 'boss',
			params: { id: 'alice' },
			body: { note: 'appeal' }
		});
		expect(res.status).toBe(204);
		const [alice] = await db.select().from(user).where(eq(user.id, 'alice'));
		expect(alice).toMatchObject({ banned: false, banReason: null, banExpires: null });
		expect(await audit()).toMatchObject([
			{ action: 'unsuspend_user', targetType: 'user', targetId: 'alice', note: 'appeal' }
		]);
		expect((await call(unsuspend as Handler, { as: 'boss', params: { id: 'alice' } })).status).toBe(
			409
		);
	});
});
