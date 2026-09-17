import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { authOptions } from './auth-options';
import type { Database } from './db';
import { schema } from './db';

/**
 * Builds the Better Auth instance for one request.
 *
 * On Workers, secrets and bindings only exist on `platform.env` at request time,
 * so auth is created per request in `hooks.server.ts` instead of at module load.
 */
export function createAuth(env: Env, db: Database) {
	return betterAuth({
		...authOptions(env),
		database: drizzleAdapter(db, { provider: 'sqlite', schema }),
		// Must stay the last plugin.
		plugins: [sveltekitCookies(getRequestEvent)]
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth['$Infer']['Session']['session'];
export type User = Auth['$Infer']['Session']['user'];
