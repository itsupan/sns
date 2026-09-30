import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler, RequestEvent } from './$types';
import { user } from '$lib/server/db/schema';
import { setBlocked } from '$lib/server/db/blocks';
import { ApiError, enforceRateLimit, requireUser, withApi } from '$lib/server/api';

/** Shared by block and unblock: auth, self check, rate limit, target must exist. */
async function prepare({ params, locals, platform }: RequestEvent) {
	const currentUser = requireUser(locals);
	const targetId = params.id;
	if (!targetId) {
		throw new ApiError(400, 'validation_failed', 'User ID is required');
	}
	if (targetId === currentUser.id) {
		throw new ApiError(400, 'validation_failed', 'You cannot block yourself');
	}
	await enforceRateLimit(platform, 'follow', currentUser.id);

	const target = await locals.db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.id, targetId))
		.limit(1);
	if (target.length === 0) {
		throw new ApiError(404, 'not_found', 'User not found');
	}
	return { blockerId: currentUser.id, blockedId: targetId };
}

/** Block `:id`, removing follows in both directions. Idempotent: blocking twice keeps one block. */
export const POST: RequestHandler = withApi(async (event) => {
	const { blockerId, blockedId } = await prepare(event);
	await setBlocked(event.locals.db, blockerId, blockedId, true);
	return json({ blocked: true });
});

/** Unblock `:id`. Idempotent: unblocking someone you haven't blocked is a no-op. */
export const DELETE: RequestHandler = withApi(async (event) => {
	const { blockerId, blockedId } = await prepare(event);
	await setBlocked(event.locals.db, blockerId, blockedId, false);
	return json({ blocked: false });
});
