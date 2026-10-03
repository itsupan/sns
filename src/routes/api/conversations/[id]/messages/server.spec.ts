import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { fakeRateLimiter } from '$lib/server/testing/rate-limiter';
import { fakeChatRooms } from '$lib/server/testing/chat-rooms';
import { conversation, message, user } from '$lib/server/db/schema';
import { getOrCreateDm, sendMessage } from '$lib/server/db/chat';
import type { ApiErrorBody } from '$lib/server/api';
import type { ChatMessage } from '$lib/chat/types';
import { GET, POST } from './+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Handler = (event: never) => Promise<Response>;

let db: Db;
let dispose: () => Promise<void>;
let dmId: string;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.batch([
		db.insert(user).values({ id: 'alice', name: 'Alice', email: 'a@test.dev' }),
		db.insert(user).values({ id: 'bob', name: 'Bob', email: 'b@test.dev' }),
		db.insert(user).values({ id: 'eve', name: 'Eve', email: 'e@test.dev' })
	]);
}, 60_000);

afterAll(() => dispose?.());

beforeEach(async () => {
	await db.delete(conversation);
	dmId = (await getOrCreateDm(db, 'alice', 'bob')).id;
});

function call(
	handler: Handler,
	{
		userId,
		id = dmId,
		body,
		search = '',
		platform
	}: { userId: string | null; id?: string; body?: unknown; search?: string; platform?: unknown }
) {
	const url = new URL(`http://localhost/api/conversations/${id}/messages${search}`);
	const event = {
		params: { id },
		url,
		locals: { db, user: userId ? { id: userId, name: userId } : null },
		platform,
		request: new Request(url, {
			method: body === undefined ? 'GET' : 'POST',
			headers: { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		})
	};
	return (handler as (e: typeof event) => Promise<Response>)(event);
}

async function errorOf(res: Response) {
	return ((await res.json()) as ApiErrorBody).error;
}

describe('GET /api/conversations/:id/messages', { timeout: REAL_D1_TIMEOUT }, () => {
	it('requires sign-in', async () => {
		expect((await call(GET as Handler, { userId: null })).status).toBe(401);
	});

	it('returns a page of history with hasMore and a cursor', async () => {
		for (const content of ['one', 'two']) {
			await sendMessage(db, { conversationId: dmId, senderId: 'alice', content });
		}
		const res = await call(GET as Handler, { userId: 'bob', search: '?limit=1' });
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			messages: ChatMessage[];
			hasMore: boolean;
			nextCursor: string | null;
		};
		expect(body.messages).toHaveLength(1);
		expect(body.messages[0]).toMatchObject({ conversationId: dmId, senderId: 'alice' });
		expect(body.hasMore).toBe(true);
		expect(body.nextCursor).toEqual(expect.any(String));
	});

	it('rejects a bad limit or cursor', async () => {
		for (const [search, field] of [
			['?limit=0', 'limit'],
			['?limit=101', 'limit'],
			['?cursor=nope', 'cursor']
		]) {
			const res = await call(GET as Handler, { userId: 'alice', search });
			expect(res.status).toBe(400);
			expect((await errorOf(res)).fields).toHaveProperty(field);
		}
	});

	it('404s a non-member before looking at the query, so nothing can be probed', async () => {
		const res = await call(GET as Handler, { userId: 'eve', search: '?cursor=nope' });
		expect(res.status).toBe(404);
		expect((await errorOf(res)).code).toBe('not_found');
	});
});

describe('POST /api/conversations/:id/messages', { timeout: REAL_D1_TIMEOUT }, () => {
	const clientId = '0b7e1c52-7d6a-4c1e-8f37-2a9d4b6c8e10';

	it('requires sign-in', async () => {
		expect((await call(POST as Handler, { userId: null, body: { content: 'hi' } })).status).toBe(
			401
		);
	});

	it('reports invalid fields by name', async () => {
		for (const [body, field] of [
			[{}, 'content'],
			[{ content: 'x'.repeat(2001) }, 'content'],
			[{ id: 'nope', content: 'hi' }, 'id']
		] as const) {
			const res = await call(POST as Handler, { userId: 'alice', body });
			expect(res.status).toBe(400);
			expect((await errorOf(res)).fields).toHaveProperty(field);
		}
		expect(await db.select().from(message)).toEqual([]);
	});

	it('pushes a new message to the room once, not again for a retried send', async () => {
		const { namespace, stubs } = fakeChatRooms();
		const platform = { env: { CHAT_ROOM: namespace } };

		const first = await call(POST as Handler, {
			userId: 'alice',
			body: { id: clientId, content: 'hello' },
			platform
		});
		expect(first.status).toBe(201);
		const { message: sent } = (await first.json()) as { message: ChatMessage };
		expect(sent).toMatchObject({ id: clientId, conversationId: dmId, content: 'hello' });
		expect(stubs.get(dmId)?.broadcast).toHaveBeenCalledExactlyOnceWith({
			type: 'message',
			message: sent
		});

		const retry = await call(POST as Handler, {
			userId: 'alice',
			body: { id: clientId, content: 'hello' },
			platform
		});
		expect(retry.status).toBe(200);
		expect(stubs.get(dmId)?.broadcast).toHaveBeenCalledOnce();
	});

	it('still stores the message when the live room is down', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { namespace, stubs } = fakeChatRooms({ failing: true });
		const res = await call(POST as Handler, {
			userId: 'alice',
			body: { content: 'hello' },
			platform: { env: { CHAT_ROOM: namespace } }
		});
		expect(res.status).toBe(201);
		expect(await db.select().from(message)).toHaveLength(1);
		await stubs.get(dmId)?.broadcast.mock.results[0].value.catch(() => {});
		await Promise.resolve();
		expect(warn).toHaveBeenCalledWith('[chat] broadcast failed', expect.any(Error));
		warn.mockRestore();
	});

	it('is rate limited per user with the chatMessage rule', async () => {
		const { namespace, windows, exhaust } = fakeRateLimiter();
		const platform = { env: { RATE_LIMITER: namespace } };
		exhaust('chatMessage', 'alice');

		const res = await call(POST as Handler, { userId: 'alice', body: { content: 'hi' }, platform });
		expect(res.status).toBe(429);
		expect(res.headers.get('Retry-After')).toMatch(/^\d+$/);
		expect(await db.select().from(message)).toEqual([]);

		const ok = await call(POST as Handler, { userId: 'bob', body: { content: 'hi' }, platform });
		expect(ok.status).toBe(201);
		expect(windows.get('chatMessage:bob')?.count).toBe(1);
	});
});
