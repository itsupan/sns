import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ApiError, withApi } from '$lib/server/api';
import { cronToken } from '$lib/server/cron-token';
import { pruneStoryViews } from '$lib/server/stories';

/** Daily cron (see worker.ts): drops the views of long-expired stories. 404 to anyone else. */
export const POST: RequestHandler = withApi(async ({ request, locals }) => {
	if (request.headers.get('x-cron-token') !== cronToken()) {
		throw new ApiError(404, 'not_found', 'Not found');
	}
	return json({ pruned: await pruneStoryViews(locals.db) });
});
