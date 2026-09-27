import { redirect, type Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { createAuth } from '$lib/server/auth';
import { getDb } from '$lib/server/db';

export const handle: Handle = async ({ event, resolve }) => {
	const db = getDb(event.platform);
	const auth = createAuth(event.platform!.env, db);

	event.locals.db = db;
	event.locals.auth = auth;

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

	return svelteKitHandler({ event, resolve, auth, building });
};
