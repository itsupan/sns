import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler, RequestEvent } from './$types';
import { user } from '$lib/server/db/schema';
import { setMuted } from '$lib/server/db/mutes';
import { ApiError, enforceRateLimit, requireUser, withApi } from '$lib/server/api';

/** Shared by mute and unmute: auth, self check, rate limit, target must exist. */
async function prepare({ params, locals, platform }: RequestEvent) {
	const currentUser = requireUser(locals);
	const targetId = params.id;
	if (!targetId) {
		throw new ApiError(400, 'validation_failed', 'User ID is required');
	}
	if (targetId === currentUser.id) {
		throw new ApiError(400, 'validation_failed', 'You cannot mute yourself');
	}
	await enforceRateLimit(platform, 'mute', currentUser.id);

	const target = await locals.db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.id, targetId))
		.limit(1);
	if (target.length === 0) {
		throw new ApiError(404, 'not_found', 'User not found');
	}
	return { muterId: currentUser.id, mutedId: targetId };
}

/**
 * Mute `:id`: their posts, stories and comments leave the caller's feeds and they stop notifying
 * the caller. They aren't told. Idempotent.
 */
export const POST: RequestHandler = withApi(async (event) => {
	const { muterId, mutedId } = await prepare(event);
	await setMuted(event.locals.db, muterId, mutedId, true);
	return json({ muted: true });
});

/** Unmute `:id`. Idempotent: unmuting someone you haven't muted is a no-op. */
export const DELETE: RequestHandler = withApi(async (event) => {
	const { muterId, mutedId } = await prepare(event);
	await setMuted(event.locals.db, muterId, mutedId, false);
	return json({ muted: false });
});
