import type { BetterAuthOptions } from 'better-auth';

export function authOptions(env: Env) {
	const hasGoogleCredentials = Boolean(
		env.GOOGLE_CLIENT_ID &&
		env.GOOGLE_CLIENT_ID !== 'replace-me' &&
		env.GOOGLE_CLIENT_SECRET &&
		env.GOOGLE_CLIENT_SECRET !== 'replace-me'
	);

	return {
		baseURL: env.BETTER_AUTH_URL || 'http://localhost:5173',
		secret:
			env.BETTER_AUTH_SECRET || 'dev_secret_key_at_least_32_characters_long_for_local_testing',
		emailAndPassword: {
			enabled: true
		},
		socialProviders: {
			...(hasGoogleCredentials
				? {
						google: {
							clientId: env.GOOGLE_CLIENT_ID,
							clientSecret: env.GOOGLE_CLIENT_SECRET
						}
					}
				: {})
		},
		session: {
			// Disable cookieCache so profile updates and database changes reflect immediately without stale cache
			cookieCache: { enabled: false }
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
