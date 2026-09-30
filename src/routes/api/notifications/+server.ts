import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConfig } from '$lib/server/config';
import { loadActivityPage } from '$lib/server/activity';
import { parsePageQuery, requireUser, withApi } from '$lib/server/api';

/** The viewer's notifications, newest first. */
export const GET: RequestHandler = withApi(async ({ url, locals, platform }) => {
	const viewer = requireUser(locals);
	const page = await parsePageQuery(url, getConfig(platform?.env).activity);
	return json(await loadActivityPage(locals.db, viewer.id, page, platform?.env));
});
