import { json } from '@sveltejs/kit';
import type { RequestEvent, RequestHandler } from './$types';
import { enforceRateLimit, requireUser, withApi } from '$lib/server/api';
import { requireVisiblePost } from '$lib/server/db/posts';
import { requireNotBlocked } from '$lib/server/db/blocks';
import { setReposted } from '$lib/server/db/reposts';

/** Shared by repost and undo: auth, rate limit, post must be live and visible to the viewer. */
async function prepare({ params, locals, platform }: RequestEvent) {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'repost', currentUser.id);
	const target = await requireVisiblePost(locals.db, currentUser.id, params.id);
	return { userId: currentUser.id, target };
}

/** Repost `:id` into the viewer's followers' feeds. Idempotent. */
export const POST: RequestHandler = withApi(async (event) => {
	const { userId, target } = await prepare(event);
	await requireNotBlocked(event.locals.db, userId, target.authorId, 'You cannot repost this post');
	const repostsCount = await setReposted(event.locals.db, userId, target, true);
	return json({ reposted: true, repostsCount });
});

/** Undo the viewer's repost of `:id`. Idempotent. */
export const DELETE: RequestHandler = withApi(async (event) => {
	const { userId, target } = await prepare(event);
	const repostsCount = await setReposted(event.locals.db, userId, target, false);
	return json({ reposted: false, repostsCount });
});
