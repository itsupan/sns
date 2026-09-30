import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, `${resolve('/login')}?redirectTo=${encodeURIComponent(url.pathname)}`);
	}
	return { email: locals.user.email };
};
