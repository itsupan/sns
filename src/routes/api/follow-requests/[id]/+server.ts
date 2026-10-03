import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { approveFollowRequest, deleteFollowRequest } from '$lib/server/db/follows';
import { ApiError, enforceRateLimit, requireUser, withApi } from '$lib/server/api';

/** Approve the request from user `:id`, who then follows the signed-in user. 404 when none is pending. */
export const POST: RequestHandler = withApi(async ({ params, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'follow', currentUser.id);
	if (!(await approveFollowRequest(locals.db, currentUser.id, params.id))) {
		throw new ApiError(404, 'not_found', 'Follow request not found');
	}
	return json({ approved: true });
});

/** Decline the request from user `:id`. Idempotent. */
export const DELETE: RequestHandler = withApi(async ({ params, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'follow', currentUser.id);
	await deleteFollowRequest(locals.db, params.id, currentUser.id);
	return json({ approved: false });
});
