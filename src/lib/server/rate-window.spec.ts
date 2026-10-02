import { describe, expect, it } from 'vitest';
import { countHit, type RateWindow } from './rate-window';

const rule = { limit: 3, windowSec: 60 };
const t0 = Date.UTC(2026, 9, 1, 12, 0, 10); // 10s into a minute window

function hits(n: number, now: number, start?: RateWindow) {
	let state = start;
	let last: ReturnType<typeof countHit> | undefined;
	for (let i = 0; i < n; i++) {
		last = countHit(state, rule, now);
		state = last.next ?? state;
	}
	return { state, last: last! };
}

describe('countHit', () => {
	it('allows up to the limit, then returns seconds until the window resets', () => {
		const { state, last } = hits(3, t0);
		expect(last.retryAfter).toBeNull();
		expect(state).toEqual({ windowStart: t0 / 1000 - 10, count: 3 });
		expect(countHit(state, rule, t0)).toEqual({ next: null, retryAfter: 50 });
	});

	it('starts a fresh window once the previous one has ended', () => {
		const { state } = hits(3, t0);
		expect(countHit(state, rule, t0 + 50_000)).toEqual({
			next: { windowStart: t0 / 1000 + 50, count: 1 },
			retryAfter: null
		});
	});

	it('counts from zero without a stored window', () => {
		expect(countHit(undefined, rule, t0).next?.count).toBe(1);
	});
});
