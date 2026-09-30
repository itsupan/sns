import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConfig } from '$lib/server/config';
import { loadSavedPage } from '$lib/server/db/saves';
import { toPostCards } from '$lib/server/db/post-cards';
import { refreshPostMediaUrls } from '$lib/server/services/storage';
import { parsePageQuery, requireUser, withApi } from '$lib/server/api';

/** The viewer's saved posts, most recently saved first. */
export const GET: RequestHandler = withApi(async ({ url, locals, platform }) => {
	const currentUser = requireUser(locals);
	const { limit, cursor } = await parsePageQuery(url, getConfig(platform?.env).saved);
	const page = await loadSavedPage(locals.db, currentUser.id, { limit, cursor });
	const cards = await toPostCards(locals.db, page.rows, currentUser.id);
	const posts = await Promise.all(cards.map((p) => refreshPostMediaUrls(p, platform?.env)));
	return json({ posts, hasMore: page.hasMore, nextCursor: page.nextCursor });
});
