import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { post } from '$lib/server/db/schema';
import { apiError, withApi } from '$lib/server/api';

export const POST: RequestHandler = withApi(async ({ params, locals }) => {
	const postId = params.id;
	if (!postId) {
		return apiError(400, 'bad_request', 'Post ID is required');
	}

	const postRows = await locals.db
		.select({ id: post.id, sharesCount: post.sharesCount })
		.from(post)
		.where(eq(post.id, postId))
		.limit(1);

	if (postRows.length === 0) {
		return apiError(404, 'not_found', 'Post not found');
	}

	const nextSharesCount = postRows[0].sharesCount + 1;
	await locals.db
		.update(post)
		.set({ sharesCount: nextSharesCount, updatedAt: new Date() })
		.where(eq(post.id, postId));

	return json({ sharesCount: nextSharesCount });
});
