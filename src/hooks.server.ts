import type { Handle } from '@sveltejs/kit';
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

	return svelteKitHandler({ event, resolve, auth, building });
};
