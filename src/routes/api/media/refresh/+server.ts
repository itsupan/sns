import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { refreshMediaUrl } from '$lib/server/services/storage';

export const POST: RequestHandler = async ({ request, platform }) => {
	let body: { urls?: unknown };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON payload' }, { status: 400 });
	}

	if (!body || !Array.isArray(body.urls)) {
		return json({ error: 'urls must be an array of media URLs' }, { status: 400 });
	}

	const rawUrls = body.urls as unknown[];
	const validUrls = rawUrls.filter((u): u is string => typeof u === 'string').slice(0, 50);

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
};
