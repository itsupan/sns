import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as v from 'valibot';
import { refreshMediaUrl } from '$lib/server/services/storage';
import { enforceRateLimit, parseBody, rateLimitSubject, withApi } from '$lib/server/api';

const RefreshRequest = v.object({
	urls: v.array(v.unknown(), 'urls must be an array of media URLs')
});

/**
 * Re-signs expired media URLs. Open to signed-out visitors (public posts must keep loading for
 * them), so it is rate limited per user, or per IP when signed out.
 */
export const POST: RequestHandler = withApi(async (event) => {
	const { request, platform } = event;
	await enforceRateLimit(platform, 'mediaRefresh', rateLimitSubject(event));
	const { urls } = await parseBody(request, RefreshRequest);
	const validUrls = urls.filter((u): u is string => typeof u === 'string').slice(0, 50);

	const refreshed: Record<string, string> = {};

	await Promise.all(
		validUrls.map(async (url) => {
			try {
				const freshUrl = await refreshMediaUrl(url, platform?.env);
				refreshed[url] = freshUrl;
			} catch (err) {
				console.warn('[media-refresh] Failed to refresh URL:', url, err);
				refreshed[url] = url;
			}
		})
	);

	return json({ refreshed });
});
