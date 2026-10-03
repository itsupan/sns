import type { BetterAuthOptions } from 'better-auth';
import { APIError } from 'better-auth/api';
import { captcha } from 'better-auth/plugins';
import { admin } from 'better-auth/plugins/admin';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { getConfig, normalizeEmail } from './config';
import {
	createEmailSender,
	emailChangeEmail,
	passwordResetEmail,
	verificationEmail
} from './email';
import { accessControl, pluginRoles } from './roles';

export function authOptions(env: Env) {
	const hasGoogleCredentials = Boolean(
		env.GOOGLE_CLIENT_ID &&
		env.GOOGLE_CLIENT_ID !== 'replace-me' &&
		env.GOOGLE_CLIENT_SECRET &&
		env.GOOGLE_CLIENT_SECRET !== 'replace-me'
	);
	const sendEmail = createEmailSender(env);
	const isBlocked = (email: string) =>
		getConfig(env).auth.blockedSignupEmails.has(normalizeEmail(email));
	const turnstileSecretKey = getConfig(env).turnstileSiteKey && env.TURNSTILE_SECRET_KEY;

	return {
		appName: 'Kizuna',
		baseURL: env.BETTER_AUTH_URL || 'http://localhost:5173',
		secret:
			env.BETTER_AUTH_SECRET || 'dev_secret_key_at_least_32_characters_long_for_local_testing',
		emailAndPassword: {
			enabled: true,
			sendResetPassword: ({ user, url }) => sendEmail(passwordResetEmail(user.email, url)),
			revokeSessionsOnPasswordReset: true
		},
		// Accounts created before verification existed are unverified, so sign-in never requires it.
		emailVerification: {
			sendVerificationEmail: ({ user, url }) => sendEmail(verificationEmail(user.email, url)),
			sendOnSignUp: true,
			autoSignInAfterVerification: true
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
						if (isBlocked(user.email)) {
							throw new APIError('FORBIDDEN', {
								code: 'SIGNUP_NOT_ALLOWED',
								message: 'This email cannot be used to create an account.'
							});
						}
						// Signup requires ticking the age/Terms checkbox, so record when that consent was given.
						return { data: { ...user, termsAcceptedAt: new Date() } };
					}
				},
				update: {
					before: async (user) => {
						if (user.email && isBlocked(user.email)) {
							throw new APIError('FORBIDDEN', {
								code: 'EMAIL_NOT_ALLOWED',
								message: 'This email cannot be used for an account.'
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
			changeEmail: {
				enabled: true,
				// A verified account approves the move from its current address first, so a stolen
				// session cannot quietly take the account over.
				sendChangeEmailConfirmation: ({ user, newEmail, url }) =>
					sendEmail(emailChangeEmail(user.email, newEmail, url))
			},
			additionalFields: {
				handle: { type: 'string', required: false, unique: true },
				bio: { type: 'string', required: false },
				title: { type: 'string', required: false },
				website: { type: 'string', required: false },
				location: { type: 'string', required: false },
				cameraGear: { type: 'string', required: false },
				// Denormalized follow counters, recomputed in the follow/unfollow batch; never user input.
				followersCount: { type: 'number', required: true, defaultValue: 0, input: false },
				followingCount: { type: 'number', required: true, defaultValue: 0, input: false },
				// Set server-side at account creation; never user input.
				termsAcceptedAt: { type: 'date', required: false, input: false },
				// Toggled through PATCH /api/users/:id, which approves pending requests on going public.
				isPrivate: { type: 'boolean', required: true, defaultValue: false, input: false }
			}
		},
		plugins: [
			// Adds `role` and the ban fields, and refuses to create a session for a banned user.
			admin({ ac: accessControl, roles: pluginRoles }),
			// Asked for after an email/password sign-in only; Google sign-ins skip it.
			twoFactor(),
			...(turnstileSecretKey
				? [
						captcha({
							provider: 'cloudflare-turnstile',
							secretKey: turnstileSecretKey,
							endpoints: ['/sign-up/email', '/request-password-reset']
						})
					]
				: [])
		]
	} satisfies BetterAuthOptions;
}
