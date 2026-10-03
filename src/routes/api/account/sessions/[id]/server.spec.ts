import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { fakeRateLimiter } from '$lib/server/testing/rate-limiter';
import { session, user } from '$lib/server/db/schema';
import { DELETE } from './+server';
import type { RequestEvent } from './$types';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

let db: Db;
let dispose: () => Promise<void>;
const platform = { env: { RATE_LIMITER: fakeRateLimiter().namespace } };

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	const s = (id: string, userId: string) => ({
		id,
		token: `token-${id}`,
		userId,
		updatedAt: new Date(),
		expiresAt: new Date(Date.now() + 86_400_000)
	});
	await db.batch([
		db.insert(user).values({ id: 'ada', name: 'Ada', email: 'ada@example.com' }),
		db.insert(user).values({ id: 'bob', name: 'Bob', email: 'bob@example.com' }),
		db.insert(session).values(s('ada-phone', 'ada')),
		db.insert(session).values(s('bob-laptop', 'bob'))
	]);
}, 60_000);

afterAll(() => dispose?.());

function revoke(id: string, userId: string | null) {
	return DELETE({
		params: { id },
		locals: { db, user: userId ? { id: userId } : null },
		platform
	} as unknown as RequestEvent);
}

const sessionIds = async () => (await db.select({ id: session.id }).from(session)).map((s) => s.id);

describe('DELETE /api/account/sessions/:id', { timeout: REAL_D1_TIMEOUT }, () => {
	it('returns 401 when signed out', async () => {
		expect((await revoke('ada-phone', null)).status).toBe(401);
	});

	it("leaves someone else's session alone", async () => {
		expect((await revoke('bob-laptop', 'ada')).status).toBe(204);
		expect(await sessionIds()).toContain('bob-laptop');
	});

	it('signs out one of your own sessions, and is idempotent', async () => {
		expect((await revoke('ada-phone', 'ada')).status).toBe(204);
		expect(await sessionIds()).toEqual(['bob-laptop']);
		expect((await revoke('ada-phone', 'ada')).status).toBe(204);
	});
});
