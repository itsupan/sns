import { betterAuth } from 'better-auth';
import { eq } from 'drizzle-orm';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { authOptions } from './auth-options';
import { schema } from './db';

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

let t: TestDb;
let auth: ReturnType<typeof makeAuth>;

function makeAuth(db: TestDb['db']) {
	const env = {
		BETTER_AUTH_URL: 'http://localhost:5173',
		SIGNUP_BLOCKED_EMAILS: 'blocked.user@gmail.com'
	} as unknown as Env;
	return betterAuth({
		...authOptions(env),
		database: drizzleAdapter(db, { provider: 'sqlite', schema })
	});
}

beforeAll(async () => {
	t = await createTestDb();
	auth = makeAuth(t.db);
}, 60_000);

afterAll(() => t?.dispose());

async function signUp(email: string) {
	return auth.api.signUpEmail({
		body: { email, password: 'correct-horse-battery', name: 'Test' },
		asResponse: true
	});
}

describe('signup blocklist on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	it('rejects a blocked email, including case, dot and +suffix variants', async () => {
		for (const email of [
			'blocked.user@gmail.com',
			'Blocked.User@GMAIL.com',
			'blockeduser+new@gmail.com'
		]) {
			const res = await signUp(email);
			expect(res.status).toBe(403);
			expect(await res.json()).toMatchObject({ code: 'SIGNUP_NOT_ALLOWED' });
		}
		const users = await t.db.select().from(schema.user);
		expect(users).toHaveLength(0);
	});

	it('still lets other emails sign up', async () => {
		const res = await signUp('someone.else@gmail.com');
		expect(res.status).toBe(200);
		const users = await t.db.select({ email: schema.user.email }).from(schema.user);
		expect(users).toEqual([{ email: 'someone.else@gmail.com' }]);
	});

	it('records when the new user accepted the Terms', async () => {
		const before = Date.now();
		const res = await signUp('consenting.user@gmail.com');
		expect(res.status).toBe(200);
		const after = Date.now();
		const [row] = await t.db
			.select({ termsAcceptedAt: schema.user.termsAcceptedAt })
			.from(schema.user)
			.where(eq(schema.user.email, 'consenting.user@gmail.com'));
		expect(row.termsAcceptedAt).toBeInstanceOf(Date);
		const ts = row.termsAcceptedAt!.getTime();
		expect(ts).toBeGreaterThanOrEqual(before);
		expect(ts).toBeLessThanOrEqual(after);
	});
});
