import { json } from '@sveltejs/kit';
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { post } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/db/posts';
import { ApiError, withApi } from '$lib/server/api';
import { requireOwnPost } from '$lib/server/api/posts';
import { MAX_PINNED_POSTS } from '$lib/constants/post-limits';

/** Pin `:id` to the top of its author's profile. Idempotent; 409 once the limit is reached. */
export const PUT: RequestHandler = withApi(async ({ params, locals, platform }) => {
	const { currentUser, postId, existingPost } = await requireOwnPost(
		locals,
		platform,
		params.id,
		'pin'
	);
	if (existingPost.pinnedAt) return json({ pinned: true });

	// The limit is checked inside the UPDATE, so concurrent pins cannot both take the last slot.
	const pinnedCount = locals.db
		.select({ count: sql<number>`count(*)` })
		.from(post)
		.where(and(eq(post.userId, currentUser.id), isNotNull(post.pinnedAt), notDeleted));
	const pinned = await locals.db
		.update(post)
		.set({ pinnedAt: new Date() })
		.where(
			and(
				eq(post.id, postId),
				eq(post.userId, currentUser.id),
				notDeleted,
				isNull(post.pinnedAt),
				sql`${pinnedCount} < ${MAX_PINNED_POSTS}`
			)
		)
		.returning({ id: post.id });

	if (pinned.length === 0) {
		throw new ApiError(409, 'pin_limit', `You can pin up to ${MAX_PINNED_POSTS} posts`);
	}
	return json({ pinned: true });
});

/** Unpin `:id` from the author's profile. Idempotent. */
export const DELETE: RequestHandler = withApi(async ({ params, locals, platform }) => {
	const { currentUser, postId } = await requireOwnPost(locals, platform, params.id, 'unpin');
	await locals.db
		.update(post)
		.set({ pinnedAt: null })
		.where(and(eq(post.id, postId), eq(post.userId, currentUser.id)));
	return json({ pinned: false });
});
