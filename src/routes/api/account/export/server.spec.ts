import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { fakeRateLimiter } from '$lib/server/testing/rate-limiter';
import { user } from '$lib/server/db/schema';
import type { ApiErrorBody } from '$lib/server/api';
import { GET } from './+server';

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

function exportData(userId: string, platform?: unknown) {
	const event = { locals: { db, user: { id: userId } }, platform };
	return (GET as unknown as (e: typeof event) => Promise<Response>)(event);
}

describe('GET /api/account/export', { timeout: REAL_D1_TIMEOUT }, () => {
	it('is a private JSON download that is never cached', async () => {
		const res = await exportData('alice');
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
		expect(res.headers.get('cache-control')).toBe('no-store');
	});

	it('404s a session whose account is gone, with the standard error code', async () => {
		const res = await exportData('ghost');
		expect(res.status).toBe(404);
		expect(((await res.json()) as ApiErrorBody).error.code).toBe('not_found');
	});

	it('is rate limited per user with the accountExport rule', async () => {
		const { namespace, windows, exhaust } = fakeRateLimiter();
		const platform = { env: { RATE_LIMITER: namespace } };
		exhaust('accountExport', 'alice');

		const res = await exportData('alice', platform);
		expect(res.status).toBe(429);
		expect(res.headers.get('Retry-After')).toMatch(/^\d+$/);

		expect((await exportData('bob', platform)).status).toBe(200);
		expect(windows.get('accountExport:bob')?.count).toBe(1);
	});
});
