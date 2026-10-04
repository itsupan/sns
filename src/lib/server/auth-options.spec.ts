import { betterAuth } from 'better-auth';
import { eq } from 'drizzle-orm';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { authOptions } from './auth-options';
import { schema } from './db';

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

const BASE = 'http://localhost:5173';
const RESEND = 'https://api.resend.com/emails';

let t: TestDb;
let auth: ReturnType<typeof makeAuth>;
let outbox: Array<{ to: string; subject: string; link: string }> = [];

function makeAuth(db: TestDb['db']) {
	const env = {
		BETTER_AUTH_URL: BASE,
		RESEND_API_KEY: 're_test',
		EMAIL_FROM: 'Kizuna <no-reply@sns.ecoapsara.com>',
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
	// Only Resend is faked; the local D1 proxy keeps the real fetch.
	const realFetch = globalThis.fetch;
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			if (String(input) !== RESEND) return realFetch(input, init);
			const { to, subject, text } = JSON.parse(init!.body as string);
			outbox.push({ to, subject, link: /https?:\/\/\S+/.exec(text)![0] });
			return Response.json({ id: 'email' });
		})
	);
}, 60_000);

afterAll(() => {
	vi.unstubAllGlobals();
	return t?.dispose();
});

afterEach(() => {
	outbox = [];
});

/** Calls the auth API like a browser on the app's origin, optionally with a session cookie. */
function call(path: string, { body, cookie }: { body?: unknown; cookie?: string } = {}) {
	return auth.handler(
		new Request(path.startsWith('http') ? path : `${BASE}/api/auth${path}`, {
			method: body === undefined ? 'GET' : 'POST',
			headers: {
				origin: BASE,
				...(body === undefined ? {} : { 'content-type': 'application/json' }),
				...(cookie ? { cookie } : {})
			},
			body: body === undefined ? undefined : JSON.stringify(body)
		})
	);
}

function sessionCookie(res: Response): string {
	const cookie = res.headers
		.getSetCookie()
		.find((c) => c.startsWith('better-auth.session_token=') && !c.includes('Max-Age=0'));
	expect(cookie).toBeDefined();
	return cookie!.split(';')[0];
}

async function signUp(email: string, password = 'correct-horse-battery') {
	const res = await call('/sign-up/email', { body: { email, password, name: 'Test' } });
	expect(res.status).toBe(200);
	return sessionCookie(res);
}

async function signIn(email: string, password: string) {
	return call('/sign-in/email', { body: { email, password } });
}

async function userByEmail(email: string) {
	const [row] = await t.db.select().from(schema.user).where(eq(schema.user.email, email));
	return row;
}

describe('auth options on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	it('names the app Kizuna', () => {
		expect(auth.options.appName).toBe('Kizuna');
	});

	it('emails a verification link on signup that verifies the address and signs in', async () => {
		await signUp('new.user@example.com');
		expect(outbox).toEqual([
			{
				to: 'new.user@example.com',
				subject: 'Verify your email for Kizuna',
				link: expect.any(String)
			}
		]);

		// Unverified accounts can still sign in.
		expect((await signIn('new.user@example.com', 'correct-horse-battery')).status).toBe(200);

		const res = await call(outbox[0].link);
		expect([200, 302]).toContain(res.status);
		sessionCookie(res);
		expect((await userByEmail('new.user@example.com')).emailVerified).toBe(true);
	});

	it('resets a password from the emailed link and signs out every session', async () => {
		const oldCookie = await signUp('forgetful@example.com', 'old-password-1');
		outbox = [];

		const request = await call('/request-password-reset', {
			body: { email: 'forgetful@example.com', redirectTo: '/reset-password' }
		});
		expect(request.status).toBe(200);
		expect(outbox).toMatchObject([
			{ to: 'forgetful@example.com', subject: 'Reset your Kizuna password' }
		]);

		const callback = await call(outbox[0].link);
		expect(callback.status).toBe(302);
		const token = new URL(callback.headers.get('location')!).searchParams.get('token');
		expect(token).toBeTruthy();

		const reset = await call('/reset-password', {
			body: { token, newPassword: 'new-password-2' }
		});
		expect(reset.status).toBe(200);

		const session = await call('/get-session', { cookie: oldCookie });
		expect(await session.json()).toBeNull();
		expect((await signIn('forgetful@example.com', 'old-password-1')).status).toBe(401);
		expect((await signIn('forgetful@example.com', 'new-password-2')).status).toBe(200);
	});

	it('answers a reset request for an unknown email the same way, without sending anything', async () => {
		const res = await call('/request-password-reset', {
			body: { email: 'nobody@example.com', redirectTo: '/reset-password' }
		});
		expect(res.status).toBe(200);
		expect(outbox).toEqual([]);
	});

	it('asks the current address of a verified account to approve an email change', async () => {
		await signUp('verified@example.com');
		await call(outbox[0].link);
		const cookie = sessionCookie(await signIn('verified@example.com', 'correct-horse-battery'));
		outbox = [];

		const res = await call('/change-email', {
			body: { newEmail: 'moved@example.com', callbackURL: '/settings' },
			cookie
		});
		expect(res.status).toBe(200);
		expect(outbox).toMatchObject([
			{ to: 'verified@example.com', subject: 'Approve your new Kizuna email' }
		]);

		// Approving sends the confirmation to the new address; opening that one moves the account.
		await call(outbox[0].link, { cookie });
		expect(outbox[1]).toMatchObject({ to: 'moved@example.com' });
		await call(outbox[1].link, { cookie });
		expect(await userByEmail('verified@example.com')).toBeUndefined();
		expect((await userByEmail('moved@example.com')).emailVerified).toBe(true);
	});

	it('refuses to move an account to a blocked email', async () => {
		const cookie = await signUp('unverified@example.com');
		outbox = [];

		await call('/change-email', {
			body: { newEmail: 'blockeduser+x@gmail.com', callbackURL: '/settings' },
			cookie
		});
		expect(outbox).toMatchObject([{ to: 'blockeduser+x@gmail.com' }]);

		const res = await call(outbox[0].link, { cookie });
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ code: 'EMAIL_NOT_ALLOWED' });
		expect(await userByEmail('unverified@example.com')).toBeDefined();
	});
});
