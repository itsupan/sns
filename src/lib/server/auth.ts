import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { authOptions } from './auth-options';
import type { Database } from './db';
import { schema } from './db';

export function createAuth(env: Env, db: Database) {
	return betterAuth({
		...authOptions(env),
		database: drizzleAdapter(db, { provider: 'sqlite', schema }),
		plugins: [sveltekitCookies(getRequestEvent)]
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth['$Infer']['Session']['session'];
export type User = Auth['$Infer']['Session']['user'];
