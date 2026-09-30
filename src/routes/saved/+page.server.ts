import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { PageServerLoad } from './$types';
import { getConfig } from '$lib/server/config';
import { loadSavedPage } from '$lib/server/db/saves';
import { toPostCards } from '$lib/server/db/post-cards';
import { refreshPostMediaUrls } from '$lib/server/services/storage';

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	if (!locals.user) {
		throw redirect(302, `${resolve('/login')}?redirectTo=${encodeURIComponent(url.pathname)}`);
	}
	const page = await loadSavedPage(locals.db, locals.user.id, {
		limit: getConfig(platform?.env).saved.defaultPageSize
	});
	const cards = await toPostCards(locals.db, page.rows, locals.user.id);
	return {
		posts: await Promise.all(cards.map((p) => refreshPostMediaUrls(p, platform?.env))),
		nextCursor: page.nextCursor
	};
};
