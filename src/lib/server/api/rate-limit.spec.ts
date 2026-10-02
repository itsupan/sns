import { afterEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ dev: true }));
vi.mock('$app/environment', () => ({
	get dev() {
		return env.dev;
	}
}));

import { ApiError, RATE_LIMITS, enforceRateLimit } from '.';
import { FAIL_CLOSED_LIMITS } from './rate-limit';
import { fakeRateLimiter } from '$lib/server/testing/rate-limiter';

const withLimiter = (namespace: unknown) =>
	({ env: { RATE_LIMITER: namespace } }) as unknown as App.Platform;

const failingLimiter = {
	idFromName: (name: string) => name,
	get: () => ({
		hit: async () => {
			throw new Error('Durable Object reset');
		}
	})
};

describe('enforceRateLimit', () => {
	it('throws a 429 ApiError with Retry-After once the limit is exceeded', async () => {
		const platform = withLimiter(fakeRateLimiter().namespace);
		for (let i = 0; i < RATE_LIMITS.createPost.limit; i++) {
			await enforceRateLimit(platform, 'createPost', 'user-1');
		}

		const err = await enforceRateLimit(platform, 'createPost', 'user-1').catch((e) => e);
		expect(err).toBeInstanceOf(ApiError);
		const res = (err as ApiError).toResponse();
		expect(res.status).toBe(429);
		expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
		expect(((await res.json()) as { error: { code: string } }).error.code).toBe('rate_limited');
	});

	it('counts each limit and subject separately', async () => {
		const { namespace, windows } = fakeRateLimiter();
		const platform = withLimiter(namespace);
		for (let i = 0; i < RATE_LIMITS.like.limit; i++) await enforceRateLimit(platform, 'like', 'a');
		await expect(enforceRateLimit(platform, 'like', 'b')).resolves.toBeUndefined();
		await expect(enforceRateLimit(platform, 'save', 'a')).resolves.toBeUndefined();
		expect([...windows.keys()].sort()).toEqual(['like:a', 'like:b', 'save:a']);
	});

	it('uses the per-environment rule from RATE_LIMIT_* vars', async () => {
		const { namespace } = fakeRateLimiter();
		const platform = {
			env: { RATE_LIMITER: namespace, RATE_LIMIT_LIKE: '1/60' }
		} as unknown as App.Platform;
		await enforceRateLimit(platform, 'like', 'a');
		const err = await enforceRateLimit(platform, 'like', 'a').catch((e) => e);
		expect((err as ApiError).status).toBe(429);
	});

	afterEach(() => {
		env.dev = true;
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it('fails closed with a 503 for write-heavy limits when the limiter fails', async () => {
		const platform = withLimiter(failingLimiter);
		vi.spyOn(console, 'error').mockImplementation(() => {});
		for (const name of FAIL_CLOSED_LIMITS) {
			const err = await enforceRateLimit(platform, name, 'a').catch((e) => e);
			expect(err).toBeInstanceOf(ApiError);
			const res = (err as ApiError).toResponse();
			expect(res.status).toBe(503);
			expect(res.headers.get('Retry-After')).toBe('60');
			expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
				'rate_limit_unavailable'
			);
		}
	});

	it('fails closed for write-heavy limits when the binding is missing outside dev/tests', async () => {
		env.dev = false;
		vi.stubEnv('MODE', 'production');
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const err = await enforceRateLimit(undefined, 'comment', 'a').catch((e) => e);
		expect((err as ApiError).status).toBe(503);
		await expect(enforceRateLimit(undefined, 'search', 'a')).resolves.toBeUndefined();
	});

	it('allows write-heavy limits without the binding in dev', async () => {
		vi.stubEnv('MODE', 'production');
		await expect(enforceRateLimit(undefined, 'createPost', 'a')).resolves.toBeUndefined();
	});

	it('allows other requests when the limiter fails', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await expect(
			enforceRateLimit(withLimiter(failingLimiter), 'like', 'a')
		).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalledOnce();
	});

	it('allows requests when no binding is present in tests', async () => {
		await expect(enforceRateLimit(undefined, 'like', 'a')).resolves.toBeUndefined();
	});
});
