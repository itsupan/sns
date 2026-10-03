import {
	json,
	redirect,
	type Handle,
	type HandleServerError,
	type RequestEvent
} from '@sveltejs/kit';
import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { createAuth } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { ApiError, enforceRateLimit, rateLimitSubject, type RateLimitName } from '$lib/server/api';

/**
 * better-auth endpoints limited per client IP: password and two-factor code guessing, signup spam,
 * email floods.
 */
const AUTH_RATE_LIMITS: Record<string, RateLimitName> = {
	'/api/auth/sign-in/email': 'signIn',
	'/api/auth/sign-up/email': 'signUp',
	'/api/auth/request-password-reset': 'authEmail',
	'/api/auth/send-verification-email': 'authEmail',
	'/api/auth/change-email': 'authEmail',
	'/api/auth/reset-password': 'passwordChange',
	'/api/auth/change-password': 'passwordChange',
	'/api/auth/two-factor/verify-totp': 'twoFactor',
	'/api/auth/two-factor/verify-backup-code': 'twoFactor'
};

/** Added to every response that does not set them itself (media routes send a stricter CSP). */
const SECURITY_HEADERS: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'X-Frame-Options': 'DENY',
	'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'"
};

/** Pages a signed-in user can open before finishing the welcome flow (each with its subpages). */
const ONBOARDING_EXEMPT = [
	'/welcome',
	'/login',
	'/signup',
	'/forgot-password',
	'/reset-password',
	'/offline',
	'/legal',
	'/admin'
];

/** Page visits (not API calls, assets or the exempt pages) that send a new user to /welcome. */
function requiresOnboarding({ request, url }: RequestEvent): boolean {
	const { pathname } = url;
	if (request.method !== 'GET' || pathname.startsWith('/api/') || pathname.startsWith('/_app/')) {
		return false;
	}
	// Files such as /robots.txt or /brand/logo-64.png.
	if (/\.[a-z0-9]+$/i.test(pathname)) return false;
	return !ONBOARDING_EXEMPT.some((page) => pathname === page || pathname.startsWith(`${page}/`));
}

function withSecurityHeaders(response: Response): Response {
	// A WebSocket upgrade comes straight from the chat room, with immutable headers.
	if (response.status === 101) return response;
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		if (!response.headers.has(name)) response.headers.set(name, value);
	}
	return response;
}

export const handle: Handle = async ({ event, resolve }) => {
	// Prerendered pages (the offline fallback) are built without bindings and are the same for
	// everyone: no database, session or rate limit.
	if (building) return withSecurityHeaders(await resolve(event));

	const db = getDb(event.platform);
	const auth = createAuth(event.platform!.env, db, event.platform!.ctx);

	event.locals.db = db;
	event.locals.auth = auth;

	const authLimit =
		event.request.method === 'POST' ? AUTH_RATE_LIMITS[event.url.pathname] : undefined;
	if (authLimit) {
		try {
			await enforceRateLimit(event.platform, authLimit, rateLimitSubject(event));
		} catch (err) {
			if (!(err instanceof ApiError)) throw err;
			// better-auth's error shape, so the sign-in form shows the message.
			return withSecurityHeaders(
				json(
					{ code: err.code.toUpperCase(), message: err.message },
					{ status: err.status, headers: err.headers }
				)
			);
		}
	}

	const result = await auth.api.getSession({ headers: event.request.headers });
	event.locals.session = result?.session ?? null;
	event.locals.user = result?.user ?? null;

	const isProtectedRoute =
		event.url.pathname === '/profile' ||
		event.url.pathname === '/profile/edit' ||
		event.url.pathname.startsWith('/profile/edit/');
	if (isProtectedRoute && !event.locals.user) {
		throw redirect(
			302,
			`/login?redirectTo=${encodeURIComponent(event.url.pathname + event.url.search)}`
		);
	}

	if (event.locals.user && !event.locals.user.onboardedAt && requiresOnboarding(event)) {
		throw redirect(
			302,
			`/welcome?redirectTo=${encodeURIComponent(event.url.pathname + event.url.search)}`
		);
	}

	return withSecurityHeaders(await svelteKitHandler({ event, resolve, auth, building }));
};

/** Logs unexpected errors with an id that the error page shows, so reports can be traced. */
export const handleError: HandleServerError = ({ error, event, status, message }) => {
	if (status === 404) return { message };
	const id = crypto.randomUUID();
	console.error({
		id,
		method: event.request.method,
		path: event.url.pathname,
		status,
		message: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : undefined
	});
	return { message: 'Something went wrong. Please try again.', id };
};
