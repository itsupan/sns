import type { PageServerLoad } from './$types';
import { getConfig } from '$lib/server/config';
import { withFreshUrls } from '$lib/server/api/moderation';
import { loadReportQueue } from '$lib/server/db/moderation';

export const load: PageServerLoad = async ({ locals, platform, parent }) => {
	// The layout's role check runs in parallel; wait for it before reading the queue.
	await parent();
	const { items, nextCursor } = await loadReportQueue(locals.db, {
		limit: getConfig(platform?.env).moderation.defaultPageSize
	});
	return {
		items: await Promise.all(items.map((item) => withFreshUrls(item, platform?.env))),
		nextCursor
	};
};
