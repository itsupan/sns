import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler, RequestEvent } from './$types';
import { user } from '$lib/server/db/schema';
import { setFollowing } from '$lib/server/db/follows';
import { ApiError, enforceRateLimit, requireUser, withApi } from '$lib/server/api';

/** Shared by follow and unfollow: auth, self check, rate limit, target must exist. */
async function prepare({ params, locals, platform }: RequestEvent) {
	const currentUser = requireUser(locals);
	const targetId = params.id;
	if (!targetId) {
		throw new ApiError(400, 'validation_failed', 'User ID is required');
	}
	if (targetId === currentUser.id) {
		throw new ApiError(400, 'validation_failed', 'You cannot follow yourself');
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
	return { followerId: currentUser.id, followingId: targetId };
}

/** Follow `:id`. Idempotent: following twice keeps one follow and the same counts. */
export const POST: RequestHandler = withApi(async (event) => {
	const { followerId, followingId } = await prepare(event);
	const counts = await setFollowing(event.locals.db, followerId, followingId, true);
	return json({ following: true, followersCount: counts.followersCount });
});

/** Unfollow `:id`. Idempotent: unfollowing someone you don't follow is a no-op. */
export const DELETE: RequestHandler = withApi(async (event) => {
	const { followerId, followingId } = await prepare(event);
	const counts = await setFollowing(event.locals.db, followerId, followingId, false);
	return json({ following: false, followersCount: counts.followersCount });
});
