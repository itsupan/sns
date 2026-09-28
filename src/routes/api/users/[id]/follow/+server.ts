import { json } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { user, userFollow } from '$lib/server/db/schema';
import { ApiError, enforceRateLimit, requireUser, withApi } from '$lib/server/api';

/** Toggles whether the current user follows `:id`. */
export const POST: RequestHandler = withApi(async ({ params, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'follow', currentUser.id);

	const targetId = params.id;
	if (!targetId) {
		throw new ApiError(400, 'bad_request', 'User ID is required');
	}
	if (targetId === currentUser.id) {
		throw new ApiError(400, 'validation_failed', 'You cannot follow yourself');
	}

	const target = await locals.db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.id, targetId))
		.limit(1);
	if (target.length === 0) {
		throw new ApiError(404, 'not_found', 'User not found');
	}

	const ownFollow = and(
		eq(userFollow.followerId, currentUser.id),
		eq(userFollow.followingId, targetId)
	);
	const existing = await locals.db
		.select({ followerId: userFollow.followerId })
		.from(userFollow)
		.where(ownFollow)
		.limit(1);
	const following = existing.length === 0;

	const toggle = following
		? locals.db
				.insert(userFollow)
				.values({ followerId: currentUser.id, followingId: targetId })
				.onConflictDoNothing()
		: locals.db.delete(userFollow).where(ownFollow);

	const [, counts] = await locals.db.batch([
		toggle,
		locals.db
			.select({ followersCount: sql<number>`count(*)` })
			.from(userFollow)
			.where(eq(userFollow.followingId, targetId))
	]);

	return json({ following, followersCount: Number(counts[0]?.followersCount ?? 0) });
});
