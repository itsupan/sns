import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { fakeRateLimiter } from '$lib/server/testing/rate-limiter';
import { fakeChatRooms } from '$lib/server/testing/chat-rooms';
import { user, userBlock } from '$lib/server/db/schema';
import { getOrCreateDm } from '$lib/server/db/chat';
import type { ApiErrorBody } from '$lib/server/api';
import { DELETE as unblock, POST as block } from './+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Handler = (event: never) => Promise<Response>;

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.batch([
		db.insert(user).values({ id: 'alice', name: 'Alice', email: 'a@test.dev' }),
		db.insert(user).values({ id: 'bob', name: 'Bob', email: 'b@test.dev' }),
		db.insert(user).values({ id: 'carol', name: 'Carol', email: 'c@test.dev' })
	]);
}, 60_000);

afterAll(() => dispose?.());

function call(handler: Handler, id: string, userId: string | null, platform?: unknown) {
	const event = { params: { id }, locals: { db, user: userId ? { id: userId } : null }, platform };
	return (handler as (e: typeof event) => Promise<Response>)(event);
}

// Blocking itself, its effects and closing the room on block are covered in db/blocks.spec.
describe('POST / DELETE /api/users/:id/block', { timeout: REAL_D1_TIMEOUT }, () => {
	it('requires sign-in, another user and an existing target for unblock too', async () => {
		expect((await call(unblock as Handler, 'bob', null)).status).toBe(401);
		const self = await call(unblock as Handler, 'alice', 'alice');
		expect(self.status).toBe(400);
		expect(((await self.json()) as ApiErrorBody).error.code).toBe('validation_failed');
	});

	it('leaves a live chat open when unblocking', async () => {
		const dm = await getOrCreateDm(db, 'alice', 'bob');
		const { namespace, stubs } = fakeChatRooms();
		expect(
			(await call(unblock as Handler, 'bob', 'alice', { env: { CHAT_ROOM: namespace } })).status
		).toBe(200);
		expect(stubs.get(dm.id)).toBeUndefined();
	});

	it('is rate limited per user with the follow rule', async () => {
		const { namespace, windows, exhaust } = fakeRateLimiter();
		const platform = { env: { RATE_LIMITER: namespace } };
		exhaust('follow', 'alice');

		for (const handler of [block, unblock]) {
			const res = await call(handler as Handler, 'carol', 'alice', platform);
			expect(res.status).toBe(429);
			expect(res.headers.get('Retry-After')).toMatch(/^\d+$/);
		}
		expect(await db.select().from(userBlock)).toEqual([]);

		expect((await call(block as Handler, 'carol', 'bob', platform)).status).toBe(200);
		expect(windows.get('follow:bob')?.count).toBe(1);
	});
});
