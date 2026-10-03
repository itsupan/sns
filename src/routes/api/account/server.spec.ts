import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { fakeRateLimiter } from '$lib/server/testing/rate-limiter';
import { user } from '$lib/server/db/schema';
import type { ApiErrorBody } from '$lib/server/api';
import { DELETE } from './+server';

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

function deleteAccount(userId: string, body: unknown, platform: unknown = { env: {} }) {
	const event = {
		locals: { db, user: { id: userId } },
		platform,
		request: new Request('http://localhost/api/account', {
			method: 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	};
	return (DELETE as unknown as (e: typeof event) => Promise<Response>)(event);
}

const exists = async (id: string) =>
	(await db.select({ id: user.id }).from(user).where(eq(user.id, id))).length > 0;

// Signed out, wrong confirmation, wrong password and success are covered in db/account-delete.spec.
describe('DELETE /api/account', { timeout: REAL_D1_TIMEOUT }, () => {
	it('names the confirmation field when it is wrong', async () => {
		const res = await deleteAccount('alice', { confirm: 'yes' });
		expect(res.status).toBe(400);
		expect(((await res.json()) as ApiErrorBody).error.fields).toEqual({
			confirm: 'Type DELETE to confirm'
		});
	});

	it('404s a session whose account is already gone', async () => {
		const res = await deleteAccount('ghost', { confirm: 'DELETE' });
		expect(res.status).toBe(404);
		expect(((await res.json()) as ApiErrorBody).error.code).toBe('not_found');
	});

	it('is rate limited per user with the accountDelete rule, before anything is deleted', async () => {
		const { namespace, windows, exhaust } = fakeRateLimiter();
		const platform = { env: { RATE_LIMITER: namespace } };
		exhaust('accountDelete', 'alice');

		const res = await deleteAccount('alice', { confirm: 'DELETE' }, platform);
		expect(res.status).toBe(429);
		expect(res.headers.get('Retry-After')).toMatch(/^\d+$/);
		expect(await exists('alice')).toBe(true);

		expect((await deleteAccount('bob', { confirm: 'DELETE' }, platform)).status).toBe(204);
		expect(windows.get('accountDelete:bob')?.count).toBe(1);
		expect(await exists('bob')).toBe(false);
	});
});
