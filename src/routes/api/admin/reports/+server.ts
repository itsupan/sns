import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { enforceRateLimit, parsePageQuery, requireModerator, withApi } from '$lib/server/api';
import { getConfig } from '$lib/server/config';
import { withFreshUrls } from '$lib/server/api/moderation';
import { loadReportQueue } from '$lib/server/db/moderation';

/**
 * The moderation queue: open reports grouped by target, most recently reported first, each with
 * its report count, reasons and a preview of the target. Moderators and admins only.
 * Query: `limit`, `cursor`.
 */
export const GET: RequestHandler = withApi(async ({ url, locals, platform }) => {
	const moderator = requireModerator(locals);
	await enforceRateLimit(platform, 'moderation', moderator.id);
	const page = await parsePageQuery(url, getConfig(platform?.env).moderation);
	const { items, nextCursor } = await loadReportQueue(locals.db, page);
	return json({
		items: await Promise.all(items.map((item) => withFreshUrls(item, platform?.env))),
		nextCursor
	});
});
