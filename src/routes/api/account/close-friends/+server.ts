import * as v from 'valibot';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { user } from '$lib/server/db/schema';
import { requireNotBlocked } from '$lib/server/db/blocks';
import { listCloseFriends, setCloseFriend } from '$lib/server/db/close-friends';
import { refreshMediaUrl } from '$lib/server/services/storage';
import { ApiError, enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';

const FriendBody = v.object({
	userId: v.pipe(v.string('User ID is required'), v.minLength(1, 'User ID is required'))
});

/** The caller's close friends, most recently added first. */
export const GET: RequestHandler = withApi(async ({ locals, platform }) => {
	const me = requireUser(locals);
	const friends = await listCloseFriends(locals.db, me.id);
	return json({
		users: await Promise.all(
			friends.map(async (u) => ({
				...u,
				image: u.image ? await refreshMediaUrl(u.image, platform?.env) : null
			}))
		)
	});
});

/**
 * Adds a user to the caller's close friends: they see the caller's close friends stories (while
 * following the caller). Not with someone blocked either way. Idempotent.
 */
export const POST: RequestHandler = withApi(async ({ locals, platform, request }) => {
	const me = requireUser(locals);
	await enforceRateLimit(platform, 'follow', me.id);
	const { userId } = await parseBody(request, FriendBody);
	if (userId === me.id) {
		throw new ApiError(400, 'validation_failed', 'You cannot add yourself');
	}

	const target = await locals.db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (target.length === 0) {
		throw new ApiError(404, 'not_found', 'User not found');
	}
	await requireNotBlocked(locals.db, me.id, userId, 'You cannot add this user');
	await setCloseFriend(locals.db, me.id, userId, true);
	return json({ userId }, { status: 201 });
});

/** Removes a user from the caller's close friends. Idempotent. */
export const DELETE: RequestHandler = withApi(async ({ locals, platform, request }) => {
	const me = requireUser(locals);
	await enforceRateLimit(platform, 'follow', me.id);
	const { userId } = await parseBody(request, FriendBody);
	await setCloseFriend(locals.db, me.id, userId, false);
	return new Response(null, { status: 204 });
});
