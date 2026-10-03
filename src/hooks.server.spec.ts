import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { RATE_LIMITS } from '$lib/server/api';
import { fakeRateLimiter } from '$lib/server/testing/rate-limiter';

vi.mock('$lib/server/db', () => ({ getDb: () => ({}) }));
vi.mock('$lib/server/auth', () => ({
	createAuth: () => ({ api: { getSession: async () => null } })
}));
vi.mock('better-auth/svelte-kit', () => ({
	svelteKitHandler: ({
		event,
		resolve
	}: {
		event: RequestEvent;
		resolve: (e: RequestEvent) => Promise<Response>;
	}) => resolve(event)
}));

const { handle, handleError } = await import('./hooks.server');

function run(
	path: string,
	{
		method = 'GET',
		platform = { env: {} },
		response = new Response('ok')
	}: { method?: string; platform?: unknown; response?: Response } = {}
) {
	const url = new URL(`https://kizuna.test${path}`);
	const event = {
		url,
		request: new Request(url, { method }),
		locals: {},
		platform,
		getClientAddress: () => '203.0.113.7'
	} as unknown as RequestEvent;
	const resolve = vi.fn(async () => response);
	return { result: handle({ event, resolve }), resolve };
}

afterEach(() => vi.restoreAllMocks());

describe('handle', () => {
	it('adds security headers without overriding a stricter one', async () => {
		const page = await run('/').result;
		expect(page.headers.get('X-Frame-Options')).toBe('DENY');
		expect(page.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(page.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
		expect(page.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");

		const sandboxed = new Response('media', { headers: { 'Content-Security-Policy': 'sandbox' } });
		const media = await run('/api/media/x', { response: sandboxed }).result;
		expect(media.headers.get('Content-Security-Policy')).toBe('sandbox');
	});

	it('limits email sign-in per IP and answers in better-auth’s error shape', async () => {
		const { namespace, windows } = fakeRateLimiter();
		windows.set('signIn:ip:203.0.113.7', {
			windowStart: Math.floor(Date.now() / 60_000) * 60,
			count: 10
		});
		const platform = { env: { RATE_LIMITER: namespace } };

		const { result, resolve } = run('/api/auth/sign-in/email', { method: 'POST', platform });
		const res = await result;
		expect(res.status).toBe(429);
		expect(res.headers.get('Retry-After')).toMatch(/^\d+$/);
		expect(await res.json()).toEqual({ code: 'RATE_LIMITED', message: expect.any(String) });
		expect(res.headers.get('X-Frame-Options')).toBe('DENY');
		expect(resolve).not.toHaveBeenCalled();

		// Other auth calls, like reading the session, are not limited.
		expect((await run('/api/auth/get-session', { platform }).result).status).toBe(200);
	});

	it.each([
		['/api/auth/request-password-reset', 'authEmail'],
		['/api/auth/send-verification-email', 'authEmail'],
		['/api/auth/change-email', 'authEmail'],
		['/api/auth/reset-password', 'passwordChange'],
		['/api/auth/change-password', 'passwordChange']
	] as const)('limits POST %s per IP with %s', async (path, name) => {
		const platform = { env: { RATE_LIMITER: fakeRateLimiter().namespace } };
		for (let i = 0; i < RATE_LIMITS[name].limit; i++) {
			expect((await run(path, { method: 'POST', platform }).result).status).toBe(200);
		}
		const res = await run(path, { method: 'POST', platform }).result;
		expect(res.status).toBe(429);
		expect(await res.json()).toEqual({ code: 'RATE_LIMITED', message: expect.any(String) });
	});

	it('refuses to send auth email while the limiter is down, but lets password changes through', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const failing = {
			idFromName: (name: string) => name,
			get: () => ({
				hit: async () => {
					throw new Error('Durable Object reset');
				}
			})
		};
		const platform = { env: { RATE_LIMITER: failing } };

		const email = await run('/api/auth/request-password-reset', { method: 'POST', platform })
			.result;
		expect(email.status).toBe(503);
		expect(await email.json()).toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE' });
		const change = await run('/api/auth/change-password', { method: 'POST', platform }).result;
		expect(change.status).toBe(200);
	});
});

describe('handleError', () => {
	const event = {
		request: new Request('https://kizuna.test/feed'),
		url: new URL('https://kizuna.test/feed')
	} as unknown as RequestEvent;

	it('logs unexpected errors with an id the error page can show', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = await handleError({
			error: new Error('D1_ERROR'),
			event,
			status: 500,
			message: 'Internal Error'
		});

		expect(result).toEqual({ message: expect.any(String), id: expect.any(String) });
		expect(log).toHaveBeenCalledWith(
			expect.objectContaining({ id: result!.id, path: '/feed', status: 500, message: 'D1_ERROR' })
		);
	});

	it('does not log not-found pages', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = await handleError({ error: null, event, status: 404, message: 'Not Found' });
		expect(result).toEqual({ message: 'Not Found' });
		expect(log).not.toHaveBeenCalled();
	});
});
