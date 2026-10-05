/*
 * Deployed Worker entry: SvelteKit's generated worker plus the Durable Object classes it binds.
 * adapter-cloudflare writes its worker to wrangler's `main`, so this wrapper is passed to
 * `wrangler deploy` / `wrangler dev` explicitly instead (see package.json scripts). It lives
 * outside src/ because it imports build output: run `pnpm build` before using it.
 *
 * The cron trigger (`triggers.crons` in wrangler.jsonc) fires every minute and calls the app's own
 * cron routes, so the work runs inside SvelteKit with its helpers; this file is bundled without
 * the `$lib` aliases.
 *
 * Starting SvelteKit in a fresh isolate can by itself pass the Workers Free plan's 10 ms CPU limit
 * per invocation, so a minute with nothing to do is detected with plain D1 queries and does not
 * start it.
 */
import app from './.svelte-kit/cloudflare/_worker.js';
import { getConfig } from './src/lib/server/config';
import { cronToken } from './src/lib/server/cron-token';

export { ChatRoom } from './src/lib/server/chat/chat-room';
export { RateLimiter } from './src/lib/server/rate-limiter';

/** Drafts whose publish time has come, as `publishDueDrafts` selects them. */
const DRAFTS_DUE = 'SELECT 1 FROM post_draft WHERE publish_at <= ?1 LIMIT 1';

/**
 * Notifications past `pushNewNotifications`' saved cursor, or no cursor yet (the first run sets it).
 * The job reads from that cursor or from an hour ago, whichever is later, so when this finds
 * nothing the job would push nothing.
 */
const PUSH_DUE = `SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM job_state WHERE name = ?1) OR EXISTS (
	SELECT 1 FROM notification WHERE (created_at, id) > (
		SELECT json_extract(value, '$.createdAt'), json_extract(value, '$.id')
		FROM job_state WHERE name = ?1
	)
)`;

/**
 * Cron jobs due at `scheduledTime`: drafts and push notifications every minute when they have work
 * (push only while it is configured), story-view pruning daily at 03:00 UTC.
 */
async function cronJobs(scheduledTime: number, env: Env): Promise<string[]> {
	const checks: [string, D1PreparedStatement][] = [
		['publish-drafts', env.DB.prepare(DRAFTS_DUE).bind(Date.now())]
	];
	if (getConfig(env).webPush) {
		checks.push(['push-notifications', env.DB.prepare(PUSH_DUE).bind('push-notifications')]);
	}
	const results = await env.DB.batch(checks.map(([, check]) => check));
	const jobs = checks.filter((_, i) => results[i].results.length > 0).map(([job]) => job);

	const at = new Date(scheduledTime);
	const daily = at.getUTCHours() === 3 && at.getUTCMinutes() === 0;
	return daily ? [...jobs, 'prune-stories'] : jobs;
}

export default {
	fetch: app.fetch,
	async scheduled(controller, env, ctx) {
		const results = await Promise.allSettled(
			(await cronJobs(controller.scheduledTime, env)).map(async (job) => {
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
