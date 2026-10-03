import { json } from '@sveltejs/kit';
import type { RequestHandler, RequestEvent } from './$types';
import { requireVisiblePost } from '$lib/server/db/posts';
import { setSaved } from '$lib/server/db/saves';
import { requireNotBlocked } from '$lib/server/db/blocks';
import { enforceRateLimit, requireUser, withApi } from '$lib/server/api';

/** Shared by save and unsave: auth, rate limit, post must exist and be visible to the viewer. */
async function prepare({ params, locals, platform }: RequestEvent) {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'save', currentUser.id);
	const { authorId } = await requireVisiblePost(locals.db, currentUser.id, params.id);
	return { userId: currentUser.id, postId: params.id, authorId };
}

/** Save `:id` to the viewer's private collection. Idempotent. */
export const PUT: RequestHandler = withApi(async (event) => {
	const { userId, postId, authorId } = await prepare(event);
	await requireNotBlocked(event.locals.db, userId, authorId, 'You cannot save this post');
	await setSaved(event.locals.db, userId, postId, true);
	return json({ saved: true });
});

/** Remove `:id` from the viewer's saved posts. Idempotent. */
export const DELETE: RequestHandler = withApi(async (event) => {
	const { userId, postId } = await prepare(event);
	await setSaved(event.locals.db, userId, postId, false);
	return json({ saved: false });
});
