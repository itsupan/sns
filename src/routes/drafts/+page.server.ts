import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { PageServerLoad } from './$types';
import { listDrafts } from '$lib/server/posts/drafts';

// Publish times show in the viewer's time zone, which only the browser knows.
export const ssr = false;

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, `${resolve('/login')}?redirectTo=${encodeURIComponent(url.pathname)}`);
	}
	return { drafts: await listDrafts(locals.db, locals.user.id) };
};
