import type { BetterAuthOptions } from 'better-auth';

/**
 * Better Auth options shared by the app (`auth.ts`) and the schema generator
 * (`better-auth.config.ts`). Anything that adds tables or columns belongs here,
 * so `pnpm auth:schema` always sees it.
 */
export function authOptions(env: Env) {
	return {
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
		socialProviders: {
			google: {
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET
			}
		},
		session: {
			// Verify most requests from a signed cookie instead of a D1 lookup.
			cookieCache: { enabled: true, maxAge: 5 * 60 }
		}
	} satisfies BetterAuthOptions;
}
