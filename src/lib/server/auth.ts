import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { dev } from '$app/environment';
import { getRequestEvent } from '$app/server';
import { authOptions } from './auth-options';
import type { Database } from './db';
import { schema } from './db';

const MIN_SECRET_LENGTH = 32;

export function createAuth(env: Env, db: Database, ctx: Pick<ExecutionContext, 'waitUntil'>) {
	// authOptions falls back to a fixed dev secret; deployed sessions must never be signed with it,
	// nor with a blank or short one (better-auth only warns about those).
	if (!dev && (env.BETTER_AUTH_SECRET?.trim().length ?? 0) < MIN_SECRET_LENGTH) {
		throw new Error(`BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
	}
	return betterAuth({
		...authOptions(env),
		database: drizzleAdapter(db, { provider: 'sqlite', schema }),
		// Emails are sent after the response, so response times never reveal whether one went out.
		advanced: { backgroundTasks: { handler: (task) => ctx.waitUntil(task) } },
		plugins: [sveltekitCookies(getRequestEvent)]
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth['$Infer']['Session']['session'];
export type User = Auth['$Infer']['Session']['user'];
