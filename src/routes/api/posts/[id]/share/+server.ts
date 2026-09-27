import { json } from '@sveltejs/kit';
import { eq, sql, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { post } from '$lib/server/db/schema';
import { apiError, withApi } from '$lib/server/api';
import { notDeleted } from '$lib/server/db/posts';

export const POST: RequestHandler = withApi(async ({ params, locals }) => {
	const postId = params.id;
	if (!postId) {
		return apiError(400, 'bad_request', 'Post ID is required');
	}

	const updated = await locals.db
		.update(post)
		.set({ sharesCount: sql`${post.sharesCount} + 1`, updatedAt: new Date() })
		.where(and(eq(post.id, postId), notDeleted))
		.returning({ sharesCount: post.sharesCount });

	if (updated.length === 0) {
		return apiError(404, 'not_found', 'Post not found');
	}

	return json({ sharesCount: updated[0].sharesCount });
});
