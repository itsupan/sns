import type { RateLimiter } from '../rate-limiter';
import { countHit, type RateWindow } from '../rate-window';

/** In-memory stand-in for the `RATE_LIMITER` namespace, counting with the real window logic. */
export function fakeRateLimiter(now = () => Date.now()) {
	const windows = new Map<string, RateWindow>();
	const namespace = {
		idFromName: (name: string) => name,
		get: (key: string) => ({
			hit: async (limit: number, windowSec: number) => {
				const { next, retryAfter } = countHit(windows.get(key), { limit, windowSec }, now());
				if (next) windows.set(key, next);
				return retryAfter;
			}
		})
	};
	return { namespace: namespace as unknown as DurableObjectNamespace<RateLimiter>, windows };
}
