import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { conversation, message, user } from './schema';
import { countUnread, dmKey } from './chat';
import { GET as inbox, POST as startDm } from '../../../routes/api/conversations/+server';
import {
	GET as history,
	POST as send
} from '../../../routes/api/conversations/[id]/messages/+server';
import { POST as read } from '../../../routes/api/conversations/[id]/read/+server';
import { GET as ws } from '../../../routes/api/chat/ws/+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
// Response bodies are asserted field by field below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.batch([
		db.insert(user).values({ id: 'alice', name: 'Alice', email: 'a@test.dev', handle: 'alice' }),
		db.insert(user).values({ id: 'bob', name: 'Bob', email: 'b@test.dev' }),
		db.insert(user).values({ id: 'eve', name: 'Eve', email: 'e@test.dev' })
	]);
}, 60_000);

afterAll(() => dispose?.());

beforeEach(async () => {
	await db.delete(conversation);
});

async function call(
	handler: unknown,
	{
		userId,
		id = '',
		body,
		search = '',
		headers = {}
	}: {
		userId: string | null;
		id?: string;
		body?: unknown;
		search?: string;
		headers?: Record<string, string>;
	}
) {
	const url = new URL(`http://localhost/x${search}`);
	const event = {
		params: { id },
		url,
		locals: { db, user: userId ? { id: userId, name: userId } : null },
		request: new Request(url, {
			method: body === undefined ? 'GET' : 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: body === undefined ? undefined : JSON.stringify(body)
		})
	};
	const res = await (handler as (e: typeof event) => Promise<Response>)(event);
	return { status: res.status, body: (await res.json()) as Json };
}

async function dm(a: string, b: string): Promise<string> {
	const res = await call(startDm, { userId: a, body: { userId: b } });
	expect([200, 201]).toContain(res.status);
	return res.body.conversation.id;
}

async function say(userId: string, id: string, content: string) {
	const res = await call(send, { userId, id, body: { content } });
	expect(res.status).toBe(201);
	return res.body.message as { id: string; createdAt: number; senderId: string };
}

describe('direct conversations on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	it('starting the same DM from either side returns one conversation', async () => {
		const first = await call(startDm, { userId: 'alice', body: { userId: 'bob' } });
		expect(first.status).toBe(201);
		expect(first.body.conversation.other).toMatchObject({ id: 'bob', slug: 'bob' });

		const again = await call(startDm, { userId: 'bob', body: { userId: 'alice' } });
		expect(again.status).toBe(200);
		expect(again.body.conversation.id).toBe(first.body.conversation.id);
		expect(again.body.conversation.other).toMatchObject({ id: 'alice', handle: '@alice' });

		const rows = await db.select().from(conversation);
		expect(rows).toHaveLength(1);
		expect(rows[0].dmKey).toBe(dmKey('bob', 'alice'));
	});

	it('concurrent starts still create a single conversation', async () => {
		const ids = await Promise.all([dm('alice', 'bob'), dm('bob', 'alice'), dm('alice', 'bob')]);
		expect(new Set(ids).size).toBe(1);
		expect(await db.select().from(conversation)).toHaveLength(1);
	});

	it('rejects messaging yourself, unknown users and anonymous callers', async () => {
		expect((await call(startDm, { userId: 'alice', body: { userId: 'alice' } })).status).toBe(400);
		expect((await call(startDm, { userId: 'alice', body: { userId: 'ghost' } })).status).toBe(404);
		expect((await call(startDm, { userId: null, body: { userId: 'bob' } })).status).toBe(401);
	});

	it('only members can read, send, mark read or connect (404, no probing)', async () => {
		const id = await dm('alice', 'bob');
		await say('alice', id, 'hi');
		expect((await call(history, { userId: 'eve', id })).status).toBe(404);
		expect((await call(send, { userId: 'eve', id, body: { content: 'x' } })).status).toBe(404);
		expect((await call(read, { userId: 'eve', id, body: {} })).status).toBe(404);
		expect(
			(
				await call(ws, {
					userId: 'eve',
					search: `?conversationId=${id}`,
					headers: { Upgrade: 'websocket' }
				})
			).status
		).toBe(404);
		expect((await call(history, { userId: 'bob', id: 'nope' })).status).toBe(404);
	});

	it('validates message content', async () => {
		const id = await dm('alice', 'bob');
		expect((await call(send, { userId: 'alice', id, body: { content: '   ' } })).status).toBe(400);
		expect(
			(await call(send, { userId: 'alice', id, body: { content: 'x'.repeat(2001) } })).status
		).toBe(400);
		const ok = await say('alice', id, '  trimmed  ');
		expect((await db.select().from(message).where(eq(message.id, ok.id)))[0].content).toBe(
			'trimmed'
		);
	});
});

describe('idempotent sends on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	const clientId = '6f1c1d7e-2b8a-4f3e-9a51-0c2d4e6f8a10';

	it('stores a retried send once and returns the original message', async () => {
		const id = await dm('alice', 'bob');
		const first = await call(send, {
			userId: 'alice',
			id,
			body: { id: clientId, content: 'once' }
		});
		expect(first.status).toBe(201);
		expect(first.body.message.id).toBe(clientId);

		const retry = await call(send, {
			userId: 'alice',
			id,
			body: { id: clientId, content: 'once' }
		});
		expect(retry.status).toBe(200);
		expect(retry.body.message).toEqual(first.body.message);
		expect(await db.select().from(message).where(eq(message.conversationId, id))).toHaveLength(1);
	});

	it('rejects an id already used by another sender or conversation', async () => {
		const withBob = await dm('alice', 'bob');
		const withEve = await dm('alice', 'eve');
		await call(send, { userId: 'alice', id: withBob, body: { id: clientId, content: 'mine' } });

		const hijack = await call(send, {
			userId: 'bob',
			id: withBob,
			body: { id: clientId, content: 'x' }
		});
		expect(hijack.status).toBe(409);
		const elsewhere = await call(send, {
			userId: 'alice',
			id: withEve,
			body: { id: clientId, content: 'x' }
		});
		expect(elsewhere.status).toBe(409);
		// The failed attempts changed nothing in the other conversation.
		expect((await call(inbox, { userId: 'eve' })).body.conversations).toEqual([]);
	});

	it('a late replay never rewinds read or activity markers', async () => {
		const id = await dm('alice', 'bob');
		await call(send, { userId: 'alice', id, body: { id: clientId, content: 'old' } });
		const newer = await say('bob', id, 'newer');
		await call(read, { userId: 'alice', id, body: {} });

		await call(send, { userId: 'alice', id, body: { id: clientId, content: 'old' } });
		const [row] = await db.select().from(conversation).where(eq(conversation.id, id));
		expect(row.lastMessageAt?.getTime()).toBe(newer.createdAt);
		expect(await countUnread(db, 'alice')).toBe(0);
	});

	it('rejects a malformed id', async () => {
		const id = await dm('alice', 'bob');
		expect(
			(await call(send, { userId: 'alice', id, body: { id: 'nope', content: 'x' } })).status
		).toBe(400);
	});
});

describe('history and catch-up on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	it('pages older history oldest-first with no gaps or repeats', async () => {
		const id = await dm('alice', 'bob');
		const sent: string[] = [];
		for (let i = 0; i < 7; i++) sent.push((await say(i % 2 ? 'bob' : 'alice', id, `m${i}`)).id);

		const first = await call(history, { userId: 'bob', id, search: '?limit=3' });
		expect(first.body.messages.map((m: { content: string }) => m.content)).toEqual([
			'm4',
			'm5',
			'm6'
		]);

		const seen: string[] = first.body.messages.map((m: { id: string }) => m.id);
		let cursor: string | null = first.body.nextCursor;
		while (cursor) {
			const page = await call(history, {
				userId: 'bob',
				id,
				search: `?limit=3&cursor=${encodeURIComponent(cursor)}`
			});
			seen.unshift(...page.body.messages.map((m: { id: string }) => m.id));
			cursor = page.body.nextCursor;
		}
		expect(seen).toEqual(sent);
	});

	it('after=<id> returns everything since that message, overlapping safely', async () => {
		const id = await dm('alice', 'bob');
		const m1 = await say('alice', id, 'one');
		await say('bob', id, 'two');
		await say('alice', id, 'three');

		const res = await call(history, { userId: 'bob', id, search: `?after=${m1.id}` });
		const contents = res.body.messages.map((m: { content: string }) => m.content);
		// The overlap window may repeat `one`; nothing after it is ever missing.
		expect(contents.slice(-2)).toEqual(['two', 'three']);
		expect(contents).toContain('three');
		expect((await call(history, { userId: 'bob', id, search: '?after=bogus' })).status).toBe(400);
	});

	it('pages a burst inside the overlap window to the end instead of repeating a page', async () => {
		const id = await dm('alice', 'bob');
		const sent: string[] = [];
		for (let i = 0; i < 7; i++) sent.push((await say('alice', id, `burst ${i}`)).id);

		// All seven were sent within the overlap window, so an overlapping page never moves on.
		const seen = new Set<string>();
		let after = sent[0];
		let strict = '';
		for (let requests = 0, more = true; more; requests++, strict = '&strict=1') {
			expect(requests).toBeLessThan(10);
			const { body } = await call(history, {
				userId: 'bob',
				id,
				search: `?limit=2&after=${after}${strict}`
			});
			for (const m of body.messages) seen.add(m.id);
			more = body.hasMore && body.messages.length > 0;
			after = body.messages.at(-1)?.id ?? after;
		}
		expect([...seen].sort()).toEqual([...sent].sort());
	});
});

describe('inbox and unread on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	it('lists conversations by latest message with previews and unread counts', async () => {
		const withBob = await dm('alice', 'bob');
		const withEve = await dm('alice', 'eve');
		// Started but empty conversations stay out of the inbox.
		expect((await call(inbox, { userId: 'alice' })).body.conversations).toEqual([]);

		await say('bob', withBob, 'hey alice');
		await say('bob', withBob, 'you there?');
		await say('eve', withEve, 'hello');

		const list = (await call(inbox, { userId: 'alice' })).body.conversations as Array<{
			id: string;
			other: { id: string };
			lastMessage: { content: string };
			unreadCount: number;
		}>;
		expect(list.map((c) => c.other.id)).toEqual(['eve', 'bob']);
		expect(list.map((c) => c.unreadCount)).toEqual([1, 2]);
		expect(list[1].lastMessage.content).toBe('you there?');
		expect(await countUnread(db, 'alice')).toBe(3);

		// Sending marks your own side read; replying moves the conversation to the top.
		await say('alice', withBob, 'yes!');
		const after = (await call(inbox, { userId: 'alice' })).body.conversations as typeof list;
		expect(after.map((c) => [c.other.id, c.unreadCount])).toEqual([
			['bob', 0],
			['eve', 1]
		]);
		// Bob has not read Alice's reply.
		expect((await call(inbox, { userId: 'bob' })).body.conversations[0].unreadCount).toBe(1);

		expect((await call(read, { userId: 'alice', id: withEve, body: {} })).status).toBe(200);
		expect(await countUnread(db, 'alice')).toBe(0);
	});

	it('pages the inbox with a cursor', async () => {
		for (const other of ['bob', 'eve']) await say('alice', await dm('alice', other), 'hi');
		const first = await call(inbox, { userId: 'alice', search: '?limit=1' });
		expect(first.body.conversations).toHaveLength(1);
		const second = await call(inbox, {
			userId: 'alice',
			search: `?limit=1&cursor=${encodeURIComponent(first.body.nextCursor)}`
		});
		expect(second.body.conversations).toHaveLength(1);
		expect(second.body.nextCursor).toBeNull();
		expect(second.body.conversations[0].id).not.toBe(first.body.conversations[0].id);
	});
});

describe('GET /api/chat/ws', { timeout: REAL_D1_TIMEOUT }, () => {
	it('requires a session and a WebSocket upgrade, and 503s without the room binding', async () => {
		const id = await dm('alice', 'bob');
		const search = `?conversationId=${id}`;
		expect((await call(ws, { userId: null, search })).status).toBe(401);
		expect((await call(ws, { userId: 'alice', search })).status).toBe(426);
		expect(
			(await call(ws, { userId: 'alice', search, headers: { Upgrade: 'websocket' } })).status
		).toBe(503);
	});
});
