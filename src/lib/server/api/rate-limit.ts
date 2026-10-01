import { dev } from '$app/environment';
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

/** Who a limit counts against: the signed-in user, or the client IP when signed out. */
export function rateLimitSubject(event: {
	locals?: Partial<App.Locals>;
	getClientAddress?: () => string;
}): string {
	if (event.locals?.user) return event.locals.user.id;
	try {
		return `ip:${event.getClientAddress?.() ?? 'unknown'}`;
	} catch {
		return 'ip:unknown';
	}
}

/**
 * Limits guarding writes that are costly or easy to abuse. When the limiter cannot run
 * (KV error, missing binding in production) these fail closed with a 503; the rest fail open.
 */
export const FAIL_CLOSED_LIMITS: ReadonlySet<RateLimitName> = new Set<RateLimitName>([
	'createPost',
	'createStory',
	'comment',
	'chatStart',
	'chatMessage',
	'uploadPresign',
	'follow',
	'share',
	'accountExport',
	'report'
]);

/** Missing KV is only acceptable in local dev and unit tests. */
function kvOptional(): boolean {
	return dev || import.meta.env.MODE === 'test';
}

function limiterUnavailable(name: RateLimitName, reason: unknown): void {
	if (FAIL_CLOSED_LIMITS.has(name)) {
		console.error(`[rate-limit] limiter unavailable, rejecting ${name}:`, reason);
		throw new ApiError(
			503,
			'rate_limit_unavailable',
			'This action is temporarily unavailable. Please try again in a minute.',
			undefined,
			{ 'Retry-After': '60' }
		);
	}
	console.warn(`[rate-limit] limiter unavailable, allowing ${name}:`, reason);
}

/**
 * Throws a 429 `ApiError` with `Retry-After` when `userId` exceeds the named limit.
 *
 * When the limiter cannot run (KV errors, e.g. once the daily write quota is exhausted, or the
 * KV binding is missing outside dev/tests), limits in `FAIL_CLOSED_LIMITS` throw a 503
 * `rate_limit_unavailable` with `Retry-After: 60`; other limits allow the request with a warning.
 * A missing binding in local dev or unit tests always allows the request.
 */
export async function enforceRateLimit(
	platform: App.Platform | undefined,
	name: RateLimitName,
	userId: string
): Promise<void> {
	const kv = platform?.env?.KV;
	if (!kv) {
		if (kvOptional()) return;
		limiterUnavailable(name, 'KV binding missing');
		return;
	}

	let retryAfter: number | null;
	try {
		retryAfter = await rateLimit(
			kv,
			`${name}:${userId}`,
			getConfig(platform?.env).rateLimits[name]
		);
	} catch (err) {
		limiterUnavailable(name, err);
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
