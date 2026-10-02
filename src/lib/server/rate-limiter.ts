/*
 * One Durable Object per rate-limited `<limit>:<subject>`. An object serves one request at a
 * time and its storage calls are atomic between awaits, so concurrent hits are counted exactly
 * (KV allows one write per key per second and is eventually consistent).
 * Exported from worker.ts at the repo root; keep imports relative (wrangler bundles this, not SvelteKit).
 */
import { DurableObject } from 'cloudflare:workers';
import { countHit, type RateWindow } from './rate-window';

const WINDOW_KEY = 'window';

export class RateLimiter extends DurableObject<Env> {
	/** Counts a hit. Returns the seconds until the window resets when over the limit, else null. */
	async hit(limit: number, windowSec: number): Promise<number | null> {
		const stored = await this.ctx.storage.get<RateWindow>(WINDOW_KEY);
		const { next, retryAfter } = countHit(stored, { limit, windowSec }, Date.now());
		if (next) {
			await this.ctx.storage.put(WINDOW_KEY, next);
			// Each new window clears the object when it ends, so idle subjects keep no storage.
			if (next.count === 1) await this.ctx.storage.setAlarm((next.windowStart + windowSec) * 1000);
		}
		return retryAfter;
	}

	async alarm(): Promise<void> {
		await this.ctx.storage.deleteAll();
	}
}
