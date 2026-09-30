import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { PageServerLoad } from './$types';
import { getConfig } from '$lib/server/config';
import { loadActivityPage } from '$lib/server/activity';

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	if (!locals.user) {
		throw redirect(302, `${resolve('/login')}?redirectTo=${encodeURIComponent(url.pathname)}`);
	}
	return loadActivityPage(
		locals.db,
		locals.user.id,
		{ limit: getConfig(platform?.env).activity.defaultPageSize },
		platform?.env
	);
};
