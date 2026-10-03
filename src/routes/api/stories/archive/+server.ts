import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parsePageQuery, requireUser, withApi } from '$lib/server/api';
import { getConfig } from '$lib/server/config';
import { loadArchivePage, withSignedMedia } from '$lib/server/stories';

/** Every story you shared, expired ones included, newest first, one page at a time. Owner only. */
export const GET: RequestHandler = withApi(async ({ url, locals, platform }) => {
	const currentUser = requireUser(locals);
	const page = await loadArchivePage(
		locals.db,
		currentUser.id,
		await parsePageQuery(url, getConfig(platform?.env).storyArchive)
	);
	return json({
		stories: await withSignedMedia(page.stories, platform?.env),
		nextCursor: page.nextCursor
	});
});
