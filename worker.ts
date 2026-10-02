/*
 * Deployed Worker entry: SvelteKit's generated worker plus the Durable Object classes it binds.
 * adapter-cloudflare writes its worker to wrangler's `main`, so this wrapper is passed to
 * `wrangler deploy` / `wrangler dev` explicitly instead (see package.json scripts). It lives
 * outside src/ because it imports build output: run `pnpm build` before using it.
 */
export { default } from './.svelte-kit/cloudflare/_worker.js';
export { ChatRoom } from './src/lib/server/chat/chat-room';
export { RateLimiter } from './src/lib/server/rate-limiter';
