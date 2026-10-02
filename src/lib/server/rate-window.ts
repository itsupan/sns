/** Hits counted in the fixed window that started at `windowStart` (unix seconds). */
export interface RateWindow {
	windowStart: number;
	count: number;
}

/**
 * Counts one hit at `now` (ms) against `limit` per `windowSec`. Returns the window to store, or,
 * when the limit is already reached, the seconds until the window resets (nothing is stored).
 */
export function countHit(
	stored: RateWindow | undefined,
	{ limit, windowSec }: { limit: number; windowSec: number },
	now: number
): { next: RateWindow; retryAfter: null } | { next: null; retryAfter: number } {
	const nowSec = Math.floor(now / 1000);
	const windowStart = nowSec - (nowSec % windowSec);
	const count = stored?.windowStart === windowStart ? stored.count : 0;
	if (count >= limit) return { next: null, retryAfter: windowStart + windowSec - nowSec };
	return { next: { windowStart, count: count + 1 }, retryAfter: null };
}
