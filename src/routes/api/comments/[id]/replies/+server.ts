import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parsePageQuery, withApi } from '$lib/server/api';
import { withFreshAvatars } from '$lib/server/api/comments';
import { getConfig } from '$lib/server/config';
import { listReplies } from '$lib/server/db/comments';

/** Replies to a top-level comment, oldest first. Query: `limit`, `cursor`. */
export const GET: RequestHandler = withApi(async ({ params, url, locals, platform }) => {
	const { limit, cursor } = await parsePageQuery(url, getConfig(platform?.env).comments);
	const page = await listReplies(locals.db, {
		commentId: params.id,
		viewerId: locals.user?.id ?? null,
		limit,
		cursor
	});
	return json({
		comments: await withFreshAvatars(page.comments, platform?.env),
		hasMore: page.hasMore,
		nextCursor: page.nextCursor
	});
});
