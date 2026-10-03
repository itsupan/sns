import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { user } from '$lib/server/db/schema';
import { getOrCreateDm, markRead, sendMessage } from '$lib/server/db/chat';
import { GET } from './+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.batch([
		db.insert(user).values({ id: 'alice', name: 'Alice', email: 'a@test.dev' }),
		db.insert(user).values({ id: 'bob', name: 'Bob', email: 'b@test.dev' }),
		db.insert(user).values({ id: 'eve', name: 'Eve', email: 'e@test.dev' })
	]);
}, 60_000);

afterAll(() => dispose?.());

async function unread(userId: string | null) {
	const event = { locals: { db, user: userId ? { id: userId, name: userId } : null } };
	const res = await (GET as unknown as (e: typeof event) => Promise<Response>)(event);
	return { status: res.status, body: await res.json() };
}

describe('GET /api/conversations/unread', { timeout: REAL_D1_TIMEOUT }, () => {
	it('requires sign-in', async () => {
		expect((await unread(null)).status).toBe(401);
	});

	it('counts messages from others across all conversations until read', async () => {
		expect(await unread('alice')).toEqual({ status: 200, body: { unread: 0 } });

		const withBob = await getOrCreateDm(db, 'alice', 'bob');
		const withEve = await getOrCreateDm(db, 'alice', 'eve');
		await sendMessage(db, { conversationId: withBob.id, senderId: 'bob', content: 'one' });
		await sendMessage(db, { conversationId: withBob.id, senderId: 'bob', content: 'two' });
		await sendMessage(db, { conversationId: withEve.id, senderId: 'alice', content: 'mine' });
		await sendMessage(db, { conversationId: withEve.id, senderId: 'eve', content: 'three' });

		expect((await unread('alice')).body).toEqual({ unread: 3 });
		// Replying marked eve's side read.
		expect((await unread('eve')).body).toEqual({ unread: 0 });

		await markRead(db, withBob.id, 'alice');
		expect((await unread('alice')).body).toEqual({ unread: 1 });
	});
});
