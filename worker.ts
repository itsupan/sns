/*
 * Deployed Worker entry: SvelteKit's generated worker plus the Durable Object classes it binds.
 * adapter-cloudflare writes its worker to wrangler's `main`, so this wrapper is passed to
 * `wrangler deploy` / `wrangler dev` explicitly instead (see package.json scripts). It lives
 * outside src/ because it imports build output: run `pnpm build` before using it.
 *
 * Cron triggers (`triggers.crons` in wrangler.jsonc) call the app's own cron routes, so the work
 * runs inside SvelteKit with its helpers; this file is bundled without the `$lib` aliases.
 */
import app from './.svelte-kit/cloudflare/_worker.js';
import { cronToken } from './src/lib/server/cron-token';

export { ChatRoom } from './src/lib/server/chat/chat-room';
export { RateLimiter } from './src/lib/server/rate-limiter';

export default {
	fetch: app.fetch,
	async scheduled(_controller, env, ctx) {
		const res = await app.fetch(
			new Request('http://internal/api/cron/prune-stories', {
				method: 'POST',
				headers: { 'x-cron-token': cronToken() }
			}),
			env,
			ctx
		);
		if (!res.ok) throw new Error(`Pruning story views failed with ${res.status}`);
	}
} satisfies ExportedHandler<Env>;
