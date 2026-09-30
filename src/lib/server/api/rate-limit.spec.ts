import { describe, expect, it, vi } from 'vitest';
import { ApiError, RATE_LIMITS, enforceRateLimit, rateLimit } from '.';

function fakeKv() {
	const store = new Map<string, { value: string; ttl?: number }>();
	const kv = {
		get: async (key: string) => store.get(key)?.value ?? null,
		put: async (key: string, value: string, opts?: { expirationTtl?: number }) => {
			store.set(key, { value, ttl: opts?.expirationTtl });
		}
	};
	return { kv: kv as unknown as KVNamespace, store };
}

const rule = { limit: 3, windowSec: 60 };
const t0 = Date.UTC(2026, 9, 1, 12, 0, 10); // 10s into a minute window

describe('rateLimit', () => {
	it('allows up to the limit, then returns seconds until reset', async () => {
		const { kv } = fakeKv();
		for (let i = 0; i < 3; i++) expect(await rateLimit(kv, 'k', rule, t0)).toBeNull();
		expect(await rateLimit(kv, 'k', rule, t0)).toBe(50);
	});

	it('starts a fresh window after the reset', async () => {
		const { kv } = fakeKv();
		for (let i = 0; i < 3; i++) await rateLimit(kv, 'k', rule, t0);
		expect(await rateLimit(kv, 'k', rule, t0 + 50_000)).toBeNull();
	});

	it('tracks keys independently', async () => {
		const { kv } = fakeKv();
		for (let i = 0; i < 3; i++) await rateLimit(kv, 'a', rule, t0);
		expect(await rateLimit(kv, 'b', rule, t0)).toBeNull();
	});

	it('never sets a KV TTL below 60 seconds', async () => {
		const { kv, store } = fakeKv();
		await rateLimit(kv, 'k', { limit: 5, windowSec: 10 }, t0);
		expect([...store.values()][0].ttl).toBeGreaterThanOrEqual(60);
	});
});

describe('enforceRateLimit', () => {
	it('throws a 429 ApiError with Retry-After once the limit is exceeded', async () => {
		const { kv } = fakeKv();
		const platform = { env: { KV: kv } } as unknown as App.Platform;
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

	it('does not affect other users', async () => {
		const { kv } = fakeKv();
		const platform = { env: { KV: kv } } as unknown as App.Platform;
		for (let i = 0; i < RATE_LIMITS.like.limit; i++) await enforceRateLimit(platform, 'like', 'a');
		await expect(enforceRateLimit(platform, 'like', 'b')).resolves.toBeUndefined();
	});

	it('allows requests when KV fails, e.g. once the daily write quota is used up', async () => {
		const kv = {
			get: async () => '0',
			put: async () => {
				throw new Error('KV put() limit exceeded for the day.');
			}
		} as unknown as KVNamespace;
		const platform = { env: { KV: kv } } as unknown as App.Platform;
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await expect(enforceRateLimit(platform, 'like', 'a')).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalledOnce();
		warn.mockRestore();
	});

	it('allows requests when no KV binding is present', async () => {
		await expect(enforceRateLimit(undefined, 'like', 'a')).resolves.toBeUndefined();
	});
});
