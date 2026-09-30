import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import {
	conversation,
	conversationMember,
	message,
	post,
	postComment,
	report,
	user
} from './schema';
import { POST as createReport } from '../../../routes/api/reports/+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Handler = (event: never) => Promise<Response>;

let db: Db;
let dispose: () => Promise<void>;

// alice writes p-1 and c-1 and messages bob in dm-1; carol is not in dm-1.
beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.batch([
		db.insert(user).values({ id: 'alice', name: 'Alice', email: 'a@test.dev' }),
		db.insert(user).values({ id: 'bob', name: 'Bob', email: 'b@test.dev' }),
		db.insert(user).values({ id: 'carol', name: 'Carol', email: 'c@test.dev' }),
		db.insert(post).values({ id: 'p-1', userId: 'alice', content: 'one' }),
		db.insert(post).values({ id: 'p-gone', userId: 'alice', content: 'x', deletedAt: new Date() }),
		db.insert(postComment).values({ id: 'c-1', postId: 'p-1', userId: 'alice', content: 'hi' }),
		db.insert(conversation).values({ id: 'dm-1', dmKey: 'alice:bob' }),
		db.insert(conversationMember).values({ conversationId: 'dm-1', userId: 'alice' }),
		db.insert(conversationMember).values({ conversationId: 'dm-1', userId: 'bob' }),
		db
			.insert(message)
			.values({ id: 'm-1', conversationId: 'dm-1', senderId: 'alice', content: 'hey' })
	]);
}, 60_000);

afterAll(() => dispose?.());

beforeEach(async () => {
	await db.delete(report);
});

function call(userId: string | null, body: unknown): Promise<Response> {
	const request = new Request('http://localhost/api/reports', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});
	const event = {
		request,
		locals: { db, user: userId ? { id: userId, name: userId, handle: null, image: null } : null }
	};
	return (createReport as Handler)(event as never);
}

const reports = () => db.select().from(report);

describe('POST /api/reports on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	it('creates a report for each target type', async () => {
		for (const [targetType, targetId] of [
			['post', 'p-1'],
			['comment', 'c-1'],
			['user', 'alice'],
			['message', 'm-1']
		]) {
			const res = await call('bob', { targetType, targetId, reason: 'spam' });
			expect(res.status).toBe(201);
			expect(await res.json()).toEqual({ reported: true });
		}
		const rows = await reports();
		expect(rows).toHaveLength(4);
		expect(rows.every((r) => r.reporterId === 'bob' && r.status === 'open')).toBe(true);
		expect(rows.every((r) => r.details === null)).toBe(true);
	});

	it('stores trimmed details', async () => {
		const res = await call('bob', {
			targetType: 'post',
			targetId: 'p-1',
			reason: 'other',
			details: '  looks fake  '
		});
		expect(res.status).toBe(201);
		const [row] = await reports();
		expect(row).toMatchObject({ reason: 'other', details: 'looks fake', targetType: 'post' });
	});

	it('requires sign-in', async () => {
		const res = await call(null, { targetType: 'post', targetId: 'p-1', reason: 'spam' });
		expect(res.status).toBe(401);
	});

	it('validates the body', async () => {
		const bad = [
			'not json',
			{ targetType: 'story', targetId: 'p-1', reason: 'spam' },
			{ targetType: 'post', targetId: '', reason: 'spam' },
			{ targetType: 'post', targetId: 'p-1', reason: 'boring' },
			{ targetType: 'post', targetId: 'p-1' },
			{ targetType: 'post', targetId: 'p-1', reason: 'spam', details: 'x'.repeat(501) }
		];
		for (const body of bad) expect((await call('bob', body)).status).toBe(400);
		expect(await reports()).toEqual([]);
	});

	it('returns 404 for missing or deleted targets', async () => {
		for (const [targetType, targetId] of [
			['post', 'nope'],
			['post', 'p-gone'],
			['comment', 'nope'],
			['user', 'nope'],
			['message', 'nope']
		]) {
			const res = await call('bob', { targetType, targetId, reason: 'spam' });
			expect(res.status).toBe(404);
		}
		expect(await reports()).toEqual([]);
	});

	it('only lets conversation members report a message', async () => {
		expect(
			(await call('carol', { targetType: 'message', targetId: 'm-1', reason: 'spam' })).status
		).toBe(404);
		expect(
			(await call('bob', { targetType: 'message', targetId: 'm-1', reason: 'spam' })).status
		).toBe(201);
		await db.update(message).set({ deletedAt: new Date() }).where(eq(message.id, 'm-1'));
		try {
			await db.delete(report);
			const res = await call('bob', { targetType: 'message', targetId: 'm-1', reason: 'spam' });
			expect(res.status).toBe(404);
		} finally {
			await db.update(message).set({ deletedAt: null }).where(eq(message.id, 'm-1'));
		}
	});

	it('rejects reporting yourself or your own content', async () => {
		for (const [targetType, targetId] of [
			['post', 'p-1'],
			['comment', 'c-1'],
			['user', 'alice'],
			['message', 'm-1']
		]) {
			const res = await call('alice', { targetType, targetId, reason: 'spam' });
			expect(res.status).toBe(400);
			expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
				'cannot_report_self'
			);
		}
		expect(await reports()).toEqual([]);
	});

	it('is idempotent while a report is open, and allows a new one once it is closed', async () => {
		const body = { targetType: 'post', targetId: 'p-1', reason: 'spam' };
		expect((await call('bob', body)).status).toBe(201);
		const again = await call('bob', { ...body, reason: 'hate' });
		expect(again.status).toBe(200);
		expect(await again.json()).toEqual({ reported: true });
		expect(await reports()).toHaveLength(1);

		// Another reporter can report the same target.
		expect((await call('carol', body)).status).toBe(201);

		await db.update(report).set({ status: 'resolved' }).where(eq(report.reporterId, 'bob'));
		expect((await call('bob', body)).status).toBe(201);
		expect(await reports()).toHaveLength(3);
	});
});
