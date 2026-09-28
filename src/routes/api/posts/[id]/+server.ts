import { json, type RequestHandler } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import { post } from '$lib/server/db/schema';
import { ApiError, requireUser, withApi } from '$lib/server/api';

export const DELETE: RequestHandler = withApi(async ({ params, locals }) => {
	const currentUser = requireUser(locals);
	const postId = params.id;

	if (!postId) {
		throw new ApiError(400, 'validation_failed', 'Post ID is required');
	}

	// Fetch the post to check ownership and existence
	const existingPosts = await locals.db
		.select({
			id: post.id,
			userId: post.userId,
			deletedAt: post.deletedAt
		})
		.from(post)
		.where(eq(post.id, postId))
		.limit(1);

	const existingPost = existingPosts[0];

	if (!existingPost || existingPost.deletedAt !== null) {
		throw new ApiError(404, 'not_found', 'Post not found');
	}

	if (existingPost.userId !== currentUser.id) {
		throw new ApiError(403, 'forbidden', 'You do not have permission to delete this post');
	}

	// Soft delete the post
	await locals.db
		.update(post)
		.set({ deletedAt: new Date() })
		.where(and(eq(post.id, postId), eq(post.userId, currentUser.id)));

	// TODO: Decrement user.posts_count when it is added to the schema.
	// TODO: Schedule R2 media cleanup for the post's media items.

	return new Response(null, { status: 204 });
});
