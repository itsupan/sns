import { ApiError } from './errors';

export interface RateLimitRule {
	/** Max requests per window. */
	limit: number;
	/** Window length in seconds. */
	windowSec: number;
}

/** Per-user limits for write endpoints. Keep README "Rate limits" in sync. */
export const RATE_LIMITS = {
	createPost: { limit: 10, windowSec: 60 },
	comment: { limit: 20, windowSec: 60 },
	like: { limit: 60, windowSec: 60 },
	follow: { limit: 30, windowSec: 60 },
	uploadPresign: { limit: 20, windowSec: 60 }
} satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

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
 * Allows the request when the KV binding is missing (unit tests, misconfigured local dev).
 */
export async function enforceRateLimit(
	platform: App.Platform | undefined,
	name: RateLimitName,
	userId: string
): Promise<void> {
	const kv = platform?.env?.KV;
	if (!kv) return;

	const retryAfter = await rateLimit(kv, `${name}:${userId}`, RATE_LIMITS[name]);
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
