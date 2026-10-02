import { dev } from '$app/environment';
import { ApiError } from './errors';
import type { RateLimiter } from '$lib/server/rate-limiter';
import {
	DEFAULT_CONFIG,
	getConfig,
	type RateLimitName,
	type RateLimitRule
} from '$lib/server/config';

export type { RateLimitName, RateLimitRule };

/** Default per-user limits; override per environment with `RATE_LIMIT_*` vars (see config). */
export const RATE_LIMITS = DEFAULT_CONFIG.rateLimits;

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
 * (Durable Object error, missing binding in production) these fail closed with a 503; the rest
 * fail open.
 */
export const FAIL_CLOSED_LIMITS: ReadonlySet<RateLimitName> = new Set<RateLimitName>([
	'createPost',
	'createStory',
	'storyReaction',
	'comment',
	'chatStart',
	'chatMessage',
	'uploadPresign',
	'upload',
	'follow',
	'share',
	'accountExport',
	'report',
	'signUp'
]);

/** A missing limiter is only acceptable in local dev (`vite dev`) and unit tests. */
function limiterOptional(): boolean {
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
 * Throws a 429 `ApiError` with `Retry-After` when `subject` (a user id, or `ip:<address>`) exceeds
 * the named limit. Counts live in the `RateLimiter` Durable Object for `<name>:<subject>`.
 *
 * When the limiter cannot run (the object errors, or the binding is missing outside dev/tests),
 * limits in `FAIL_CLOSED_LIMITS` throw a 503 `rate_limit_unavailable` with `Retry-After: 60`;
 * other limits allow the request with a warning.
 */
export async function enforceRateLimit(
	platform: App.Platform | undefined,
	name: RateLimitName,
	subject: string
): Promise<void> {
	const limiters = platform?.env?.RATE_LIMITER as DurableObjectNamespace<RateLimiter> | undefined;
	if (!limiters) {
		if (limiterOptional()) return;
		limiterUnavailable(name, 'RATE_LIMITER binding missing');
		return;
	}

	const { limit, windowSec } = getConfig(platform?.env).rateLimits[name];
	let retryAfter: number | null;
	try {
		retryAfter = await limiters
			.get(limiters.idFromName(`${name}:${subject}`))
			.hit(limit, windowSec);
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
