// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- generated global `Env` types, not an importable module
/// <reference path="../worker-configuration.d.ts" />
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
			db: Database;
			auth: Auth;
			user: User | null;
			session: Session | null;
		}
	}
}

export {};
