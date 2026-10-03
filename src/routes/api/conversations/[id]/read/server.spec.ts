import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { fakeRateLimiter } from '$lib/server/testing/rate-limiter';
import { conversation, user } from '$lib/server/db/schema';
import { countUnread, getOrCreateDm, sendMessage } from '$lib/server/db/chat';
import { POST } from './+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

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

// alice has one unread message from bob; bob read everything by replying.
beforeEach(async () => {
	await db.delete(conversation);
	dmId = (await getOrCreateDm(db, 'alice', 'bob')).id;
	await sendMessage(db, { conversationId: dmId, senderId: 'alice', content: 'hi bob' });
	await sendMessage(db, { conversationId: dmId, senderId: 'bob', content: 'hi alice' });
});

function read(
	userId: string | null,
	{ id = dmId, platform }: { id?: string; platform?: unknown } = {}
) {
	const event = {
		params: { id },
		locals: { db, user: userId ? { id: userId, name: userId } : null },
		platform
	};
	return (POST as unknown as (e: typeof event) => Promise<Response>)(event);
}

describe('POST /api/conversations/:id/read', { timeout: REAL_D1_TIMEOUT }, () => {
	it('marks the conversation read', async () => {
		expect(await countUnread(db, 'alice')).toBe(1);
		const res = await read('alice');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
		expect(await countUnread(db, 'alice')).toBe(0);
	});

	it('requires sign-in and membership', async () => {
		expect((await read(null)).status).toBe(401);
		expect((await read('eve')).status).toBe(404);
		expect((await read('alice', { id: 'nope' })).status).toBe(404);
		expect(await countUnread(db, 'alice')).toBe(1);
	});

	it('is rate limited per user with the markRead rule', async () => {
		const { namespace, windows, exhaust } = fakeRateLimiter();
		const platform = { env: { RATE_LIMITER: namespace } };
		exhaust('markRead', 'alice');

		const res = await read('alice', { platform });
		expect(res.status).toBe(429);
		expect(res.headers.get('Retry-After')).toMatch(/^\d+$/);
		expect(await countUnread(db, 'alice')).toBe(1);

		expect((await read('bob', { platform })).status).toBe(200);
		expect(windows.get('markRead:bob')?.count).toBe(1);
	});
});
