import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { fakeRateLimiter } from '$lib/server/testing/rate-limiter';
import { notification, notificationRead, user } from '$lib/server/db/schema';
import { countUnreadNotifications } from '$lib/server/db/notifications';
import type { ApiErrorBody } from '$lib/server/api';
import { POST } from './+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.batch([
		db.insert(user).values({ id: 'alice', name: 'Alice', email: 'a@test.dev' }),
		db.insert(user).values({ id: 'bob', name: 'Bob', email: 'b@test.dev' })
	]);
}, 60_000);

afterAll(() => dispose?.());

beforeEach(async () => {
	await db.batch([db.delete(notification), db.delete(notificationRead)]);
});

function markRead(userId: string | null, body: unknown, platform?: unknown) {
	const event = {
		locals: { db, user: userId ? { id: userId } : null },
		platform,
		request: new Request('http://localhost/api/notifications/read', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	};
	return (POST as unknown as (e: typeof event) => Promise<Response>)(event);
}

/** A follow from bob to alice, `msFromNow` from now. */
const followAt = (msFromNow: number) =>
	db.insert(notification).values({
		id: crypto.randomUUID(),
		recipientId: 'alice',
		actorId: 'bob',
		type: 'follow',
		dedupeKey: crypto.randomUUID(),
		createdAt: new Date(Date.now() + msFromNow)
	});

// Moving the marker forward only and a non-numeric upTo are covered in db/notifications.spec.
describe('POST /api/notifications/read', { timeout: REAL_D1_TIMEOUT }, () => {
	it('requires sign-in', async () => {
		expect((await markRead(null, { upTo: 0 })).status).toBe(401);
	});

	it('names upTo when it is missing or not a timestamp', async () => {
		for (const body of [{}, { upTo: -1 }, { upTo: 1.5 }]) {
			const res = await markRead('alice', body);
			expect(res.status).toBe(400);
			expect(((await res.json()) as ApiErrorBody).error.fields).toHaveProperty('upTo');
		}
	});

	it('never marks activity newer than now as read, whatever the client clock says', async () => {
		await followAt(-60_000);
		await followAt(60_000);

		const res = await markRead('alice', { upTo: Date.now() + 3_600_000 });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
		expect(await countUnreadNotifications(db, 'alice')).toBe(1);
	});

	it('is rate limited per user with the markRead rule', async () => {
		await followAt(-60_000);
		const { namespace, windows, exhaust } = fakeRateLimiter();
		const platform = { env: { RATE_LIMITER: namespace } };
		exhaust('markRead', 'alice');

		const res = await markRead('alice', { upTo: Date.now() }, platform);
		expect(res.status).toBe(429);
		expect(res.headers.get('Retry-After')).toMatch(/^\d+$/);
		expect(await countUnreadNotifications(db, 'alice')).toBe(1);

		expect((await markRead('bob', { upTo: Date.now() }, platform)).status).toBe(200);
		expect(windows.get('markRead:bob')?.count).toBe(1);
	});
});
