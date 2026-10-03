import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ApiError, withApi } from '$lib/server/api';
import { cronToken } from '$lib/server/cron-token';
import { publishDueDrafts } from '$lib/server/posts/drafts';

/** Every-minute cron (see worker.ts): publishes the drafts now due. 404 to anyone else. */
export const POST: RequestHandler = withApi(async ({ request, locals, platform }) => {
	if (request.headers.get('x-cron-token') !== cronToken()) {
		throw new ApiError(404, 'not_found', 'Not found');
	}
	return json(await publishDueDrafts(locals.db, platform));
});
