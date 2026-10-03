import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { FOLLOW_MAX_PAGE_SIZE, FOLLOW_PAGE_SIZE } from '$lib/server/db/follows';
import { loadFollowRequestsPage } from '$lib/server/activity';
import { parsePageQuery, requireUser, withApi } from '$lib/server/api';

/** The signed-in user's pending follow requests, newest first. Query: `limit`, `cursor`. */
export const GET: RequestHandler = withApi(async ({ url, locals, platform }) => {
	const currentUser = requireUser(locals);
	const page = await parsePageQuery(url, {
		defaultPageSize: FOLLOW_PAGE_SIZE,
		maxPageSize: FOLLOW_MAX_PAGE_SIZE
	});
	return json(await loadFollowRequestsPage(locals.db, currentUser.id, page, platform?.env));
});
