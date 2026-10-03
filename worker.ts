/*
 * Deployed Worker entry: SvelteKit's generated worker plus the Durable Object classes it binds.
 * adapter-cloudflare writes its worker to wrangler's `main`, so this wrapper is passed to
 * `wrangler deploy` / `wrangler dev` explicitly instead (see package.json scripts). It lives
 * outside src/ because it imports build output: run `pnpm build` before using it.
 *
 * The cron trigger (`triggers.crons` in wrangler.jsonc) fires every minute and calls the app's own
 * cron routes, so the work runs inside SvelteKit with its helpers; this file is bundled without
 * the `$lib` aliases.
 */
import app from './.svelte-kit/cloudflare/_worker.js';
import { cronToken } from './src/lib/server/cron-token';

export { ChatRoom } from './src/lib/server/chat/chat-room';
export { RateLimiter } from './src/lib/server/rate-limiter';

/**
 * Cron jobs due at `scheduledTime`: drafts and push notifications every minute, story-view pruning
 * daily at 03:00 UTC.
 */
function cronJobs(scheduledTime: number): string[] {
	const at = new Date(scheduledTime);
	const daily = at.getUTCHours() === 3 && at.getUTCMinutes() === 0;
	const everyMinute = ['publish-drafts', 'push-notifications'];
	return daily ? [...everyMinute, 'prune-stories'] : everyMinute;
}

export default {
	fetch: app.fetch,
	async scheduled(controller, env, ctx) {
		const results = await Promise.allSettled(
			cronJobs(controller.scheduledTime).map(async (job) => {
				const res = await app.fetch(
					new Request(`http://internal/api/cron/${job}`, {
						method: 'POST',
						headers: { 'x-cron-token': cronToken() }
					}),
					env,
					ctx
				);
				if (!res.ok) throw new Error(`Cron job ${job} failed with ${res.status}`);
			})
		);
		const failure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
		if (failure) throw failure.reason;
	}
} satisfies ExportedHandler<Env>;
