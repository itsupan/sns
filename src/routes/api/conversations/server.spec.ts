import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { fakeRateLimiter } from '$lib/server/testing/rate-limiter';
import { conversation, user } from '$lib/server/db/schema';
import { getOrCreateDm, sendMessage } from '$lib/server/db/chat';
import type { ApiErrorBody } from '$lib/server/api';
import type { InboxItem } from '$lib/chat/types';
import { GET, POST } from './+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Handler = (event: never) => Promise<Response>;

interface InboxBody {
	conversations: InboxItem[];
	hasMore: boolean;
	nextCursor: string | null;
}

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.batch([
		db.insert(user).values({ id: 'alice', name: 'Alice', email: 'a@test.dev', handle: 'alice' }),
		db.insert(user).values({
			id: 'bob',
			name: 'Bob',
			email: 'b@test.dev',
			// A stored private-bucket URL, unusable in a browser until refreshed.
			image: 'https://acc.r2.cloudflarestorage.com/bucket/avatars/bob/me.jpg'
		}),
		db.insert(user).values({ id: 'eve', name: 'Eve', email: 'e@test.dev' })
	]);
}, 60_000);

afterAll(() => dispose?.());

beforeEach(async () => {
	await db.delete(conversation);
});

function call(
	handler: Handler,
	{
		userId,
		body,
		search = '',
		platform
	}: { userId: string | null; body?: unknown; search?: string; platform?: unknown }
) {
	const url = new URL(`http://localhost/api/conversations${search}`);
	const event = {
		url,
		locals: { db, user: userId ? { id: userId, name: userId } : null },
		platform,
		request: new Request(url, {
			method: body === undefined ? 'GET' : 'POST',
			headers: { 'content-type': 'application/json' },
			body: typeof body === 'string' || body === undefined ? body : JSON.stringify(body)
		})
	};
	return (handler as (e: typeof event) => Promise<Response>)(event);
}

async function errorOf(res: Response) {
	return ((await res.json()) as ApiErrorBody).error;
}

describe('GET /api/conversations', { timeout: REAL_D1_TIMEOUT }, () => {
	it('requires sign-in', async () => {
		expect((await call(GET as Handler, { userId: null })).status).toBe(401);
	});

	it('pages the inbox with hasMore and a cursor, with servable avatars', async () => {
		for (const other of ['bob', 'eve']) {
			const dm = await getOrCreateDm(db, 'alice', other);
			await sendMessage(db, { conversationId: dm.id, senderId: other, content: 'hi' });
		}

		const res = await call(GET as Handler, { userId: 'alice', search: '?limit=1' });
		expect(res.status).toBe(200);
		const first = (await res.json()) as InboxBody;
		expect(first.conversations).toHaveLength(1);
		expect(first.hasMore).toBe(true);
		expect(first.nextCursor).toEqual(expect.any(String));

		const second = (await (
			await call(GET as Handler, {
				userId: 'alice',
				search: `?limit=1&cursor=${encodeURIComponent(first.nextCursor!)}`
			})
		).json()) as InboxBody;
		expect(second).toMatchObject({ hasMore: false, nextCursor: null });
		const others = [...first.conversations, ...second.conversations].map((c) => c.other);
		expect(others.map((o) => o.id).sort()).toEqual(['bob', 'eve']);
		expect(others.find((o) => o.id === 'bob')?.image).toBe('/api/media/avatars/bob/me.jpg');
	});

	it('rejects a bad limit or cursor', async () => {
		for (const [search, field] of [
			['?limit=0', 'limit'],
			['?limit=51', 'limit'],
			['?cursor=nope', 'cursor']
		]) {
			const res = await call(GET as Handler, { userId: 'alice', search });
			expect(res.status).toBe(400);
			expect((await errorOf(res)).fields).toHaveProperty(field);
		}
	});
});

describe('POST /api/conversations', { timeout: REAL_D1_TIMEOUT }, () => {
	it('requires sign-in', async () => {
		expect((await call(POST as Handler, { userId: null, body: { userId: 'bob' } })).status).toBe(
			401
		);
	});

	it('returns the conversation with the other member', async () => {
		const res = await call(POST as Handler, { userId: 'alice', body: { userId: 'bob' } });
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({
			conversation: {
				id: expect.any(String),
				other: expect.objectContaining({ id: 'bob', name: 'Bob', slug: 'bob' })
			}
		});
	});

	it('requires a user to talk to', async () => {
		for (const body of [{}, { userId: '   ' }, { userId: 42 }]) {
			const res = await call(POST as Handler, { userId: 'alice', body });
			expect(res.status).toBe(400);
			expect(await errorOf(res)).toMatchObject({
				code: 'validation_failed',
				fields: { userId: expect.any(String) }
			});
		}
		const res = await call(POST as Handler, { userId: 'alice', body: '{nope' });
		expect((await errorOf(res)).code).toBe('invalid_json');
		expect(await db.select().from(conversation)).toEqual([]);
	});

	it('is rate limited per user with the chatStart rule', async () => {
		const { namespace, windows, exhaust } = fakeRateLimiter();
		const platform = { env: { RATE_LIMITER: namespace } };
		exhaust('chatStart', 'alice');

		const res = await call(POST as Handler, { userId: 'alice', body: { userId: 'bob' }, platform });
		expect(res.status).toBe(429);
		expect(res.headers.get('Retry-After')).toMatch(/^\d+$/);
		expect(await db.select().from(conversation)).toEqual([]);

		const ok = await call(POST as Handler, { userId: 'eve', body: { userId: 'bob' }, platform });
		expect(ok.status).toBe(201);
		expect(windows.get('chatStart:eve')?.count).toBe(1);
	});
});
