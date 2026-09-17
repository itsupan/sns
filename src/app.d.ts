// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- generated global `Env` types, not an importable module
/// <reference path="../worker-configuration.d.ts" />
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Auth, Session, User } from '$lib/server/auth';
import type { Database } from '$lib/server/db';

declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		interface Locals {
			/** Typed Drizzle client bound to the request's D1 database. */
			db: Database;
			/** Better Auth instance for this request. */
			auth: Auth;
			/** Signed-in user and session, or `null` when signed out. */
			user: User | null;
			session: Session | null;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
