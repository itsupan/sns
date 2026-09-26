import type { BetterAuthOptions } from 'better-auth';

export function authOptions(env: Env) {
	return {
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
		emailAndPassword: {
			enabled: true
		},
		socialProviders: {
			google: {
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET
			}
		},
		session: {
			cookieCache: { enabled: true, maxAge: 5 * 60 }
		},
		user: {
			additionalFields: {
				handle: { type: 'string', required: false },
				bio: { type: 'string', required: false },
				title: { type: 'string', required: false },
				website: { type: 'string', required: false },
				location: { type: 'string', required: false },
				cameraGear: { type: 'string', required: false }
			}
		}
	} satisfies BetterAuthOptions;
}
