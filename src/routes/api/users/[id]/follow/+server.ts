import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler, RequestEvent } from './$types';
import { user } from '$lib/server/db/schema';
import { isFollowing, requestFollow, setFollowing } from '$lib/server/db/follows';
import { requireNotBlocked } from '$lib/server/db/blocks';
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
		.select({ isPrivate: user.isPrivate, followersCount: user.followersCount })
		.from(user)
		.where(eq(user.id, targetId))
		.limit(1);
	if (target.length === 0) {
		throw new ApiError(404, 'not_found', 'User not found');
	}
	return { followerId: currentUser.id, followingId: targetId, target: target[0] };
}

/**
 * Follow `:id`, or ask to when it is a private account the viewer does not follow yet (`status`
 * says which). Idempotent: repeating keeps one follow or request and the same counts. 403 when
 * either user blocked the other.
 */
export const POST: RequestHandler = withApi(async (event) => {
	const { db } = event.locals;
	const { followerId, followingId, target } = await prepare(event);
	await requireNotBlocked(db, followerId, followingId, 'You cannot follow this user');
	if (target.isPrivate && !(await isFollowing(db, followerId, followingId))) {
		await requestFollow(db, followerId, followingId);
		return json({ status: 'requested', followersCount: target.followersCount });
	}
	const counts = await setFollowing(db, followerId, followingId, true);
	return json({ status: 'following', followersCount: counts.followersCount });
});

/** Unfollow `:id`, or withdraw a pending request. Idempotent: with neither it is a no-op. */
export const DELETE: RequestHandler = withApi(async (event) => {
	const { followerId, followingId } = await prepare(event);
	const counts = await setFollowing(event.locals.db, followerId, followingId, false);
	return json({ status: 'none', followersCount: counts.followersCount });
});
