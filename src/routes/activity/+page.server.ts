import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { PageServerLoad } from './$types';
import { getConfig } from '$lib/server/config';
import { loadActivityPage, loadFollowRequestsPage } from '$lib/server/activity';
import { FOLLOW_PAGE_SIZE } from '$lib/server/db/follows';

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	if (!locals.user) {
		throw redirect(302, `${resolve('/login')}?redirectTo=${encodeURIComponent(url.pathname)}`);
	}
	const [activity, requests] = await Promise.all([
		loadActivityPage(
			locals.db,
			locals.user.id,
			{ limit: getConfig(platform?.env).activity.defaultPageSize },
			platform?.env
		),
		loadFollowRequestsPage(locals.db, locals.user.id, { limit: FOLLOW_PAGE_SIZE }, platform?.env)
	]);
	return { ...activity, requests };
};
