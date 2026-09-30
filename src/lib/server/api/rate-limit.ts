import { ApiError } from './errors';
import {
	DEFAULT_CONFIG,
	getConfig,
	type RateLimitName,
	type RateLimitRule
} from '$lib/server/config';

export type { RateLimitName, RateLimitRule };

/** Default per-user limits; override per environment with `RATE_LIMIT_*` vars (see config). */
export const RATE_LIMITS = DEFAULT_CONFIG.rateLimits;

// KV rejects expirations shorter than 60 seconds.
const MIN_KV_TTL = 60;

/**
 * Fixed-window counter in KV. Returns the seconds until the window resets when the limit
 * is exceeded, or `null` when the request is allowed.
 *
 * KV has no atomic increment and is eventually consistent, so under a burst a few extra
 * requests can slip through. That is fine for abuse protection; do not use it for quotas.
 */
export async function rateLimit(
	kv: KVNamespace,
	key: string,
	{ limit, windowSec }: RateLimitRule,
	now = Date.now()
): Promise<number | null> {
	const nowSec = Math.floor(now / 1000);
	const windowStart = nowSec - (nowSec % windowSec);
	const retryAfter = windowStart + windowSec - nowSec;
	const kvKey = `rl:${key}:${windowStart}`;

	const used = Number(await kv.get(kvKey)) || 0;
	if (used >= limit) return retryAfter;

	await kv.put(kvKey, String(used + 1), {
		expirationTtl: Math.max(MIN_KV_TTL, retryAfter + 1)
	});
	return null;
}

/**
 * Throws a 429 `ApiError` with `Retry-After` when `userId` exceeds the named limit.
 * Allows the request when the KV binding is missing (unit tests, misconfigured local dev) or
 * when KV errors, e.g. once the daily write quota is exhausted.
 */
export async function enforceRateLimit(
	platform: App.Platform | undefined,
	name: RateLimitName,
	userId: string
): Promise<void> {
	const kv = platform?.env?.KV;
	if (!kv) return;

	let retryAfter: number | null;
	try {
		retryAfter = await rateLimit(
			kv,
			`${name}:${userId}`,
			getConfig(platform?.env).rateLimits[name]
		);
	} catch (err) {
		// KV failing (e.g. the Free plan's daily write quota is used up) must not take the action
		// down with it: allow the request and stop rate limiting until KV recovers.
		console.warn(`[rate-limit] KV unavailable, allowing ${name}:`, err);
		return;
	}
	if (retryAfter !== null) {
		throw new ApiError(
			429,
			'rate_limited',
			'Too many requests. Please slow down and try again shortly.',
			undefined,
			{ 'Retry-After': String(retryAfter) }
		);
	}
}
