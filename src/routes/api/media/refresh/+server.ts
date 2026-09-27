import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as v from 'valibot';
import { refreshMediaUrl } from '$lib/server/services/storage';
import { parseBody, withApi } from '$lib/server/api';

const RefreshRequest = v.object({
	urls: v.array(v.unknown(), 'urls must be an array of media URLs')
});

export const POST: RequestHandler = withApi(async ({ request, platform }) => {
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
