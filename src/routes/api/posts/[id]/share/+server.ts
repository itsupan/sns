import { json } from '@sveltejs/kit';
import { eq, sql, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { post } from '$lib/server/db/schema';
import { apiError, enforceRateLimit, requireUser, withApi } from '$lib/server/api';
import { notDeleted } from '$lib/server/db/posts';
import { requireNotBlocked } from '$lib/server/db/blocks';

export const POST: RequestHandler = withApi(async ({ params, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'share', currentUser.id);

	const postId = params.id;
	if (!postId) {
		return apiError(400, 'bad_request', 'Post ID is required');
	}

	const [target] = await locals.db
		.select({ authorId: post.userId })
		.from(post)
		.where(and(eq(post.id, postId), notDeleted))
		.limit(1);
	if (!target) {
		return apiError(404, 'not_found', 'Post not found');
	}
	await requireNotBlocked(locals.db, currentUser.id, target.authorId, 'You cannot share this post');

	const [updated] = await locals.db
		.update(post)
		.set({ sharesCount: sql`${post.sharesCount} + 1`, updatedAt: new Date() })
		.where(and(eq(post.id, postId), notDeleted))
		.returning({ sharesCount: post.sharesCount });
	if (!updated) {
		return apiError(404, 'not_found', 'Post not found');
	}

	return json({ sharesCount: updated.sharesCount });
});
