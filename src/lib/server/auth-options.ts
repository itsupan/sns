import type { BetterAuthOptions } from 'better-auth';
import { APIError } from 'better-auth/api';
import { getConfig, normalizeEmail } from './config';

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
		databaseHooks: {
			user: {
				create: {
					// Runs for every signup path (email/password and Google), so one check covers both.
					before: async (user) => {
						const blocked = getConfig(env).auth.blockedSignupEmails;
						if (blocked.has(normalizeEmail(user.email))) {
							throw new APIError('FORBIDDEN', {
								code: 'SIGNUP_NOT_ALLOWED',
								message: 'This email cannot be used to create an account.'
							});
						}
					}
				}
			}
		},
		session: {
			// Disable cookieCache so profile updates and database changes reflect immediately without stale cache
			cookieCache: { enabled: false }
		},
		user: {
			additionalFields: {
				handle: { type: 'string', required: false, unique: true },
				bio: { type: 'string', required: false },
				title: { type: 'string', required: false },
				website: { type: 'string', required: false },
				location: { type: 'string', required: false },
				cameraGear: { type: 'string', required: false },
				// Denormalized follow counters, recomputed in the follow/unfollow batch; never user input.
				followersCount: { type: 'number', required: true, defaultValue: 0, input: false },
				followingCount: { type: 'number', required: true, defaultValue: 0, input: false }
			}
		}
	} satisfies BetterAuthOptions;
}
