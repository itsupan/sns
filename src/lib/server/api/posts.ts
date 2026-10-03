import { eq } from 'drizzle-orm';
import { post } from '$lib/server/db/schema';
import { ApiError } from './errors';
import { requireUser } from './guards';
import { enforceRateLimit } from './rate-limit';

/** Loads a live post and checks the current user wrote it; 404 before 403 so ids are not probed. */
export async function requireOwnPost(
	locals: App.Locals,
	platform: App.Platform | undefined,
	postId: string | undefined,
	action: string
) {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'contentEdit', currentUser.id);
	if (!postId) {
		throw new ApiError(400, 'validation_failed', 'Post ID is required');
	}

	const [existingPost] = await locals.db
		.select({
			id: post.id,
			userId: post.userId,
			deletedAt: post.deletedAt,
			content: post.content,
			postType: post.postType,
			background: post.background,
			pinnedAt: post.pinnedAt
		})
		.from(post)
		.where(eq(post.id, postId))
		.limit(1);

	if (!existingPost || existingPost.deletedAt !== null) {
		throw new ApiError(404, 'not_found', 'Post not found');
	}
	if (existingPost.userId !== currentUser.id) {
		throw new ApiError(403, 'forbidden', `You do not have permission to ${action} this post`);
	}
	return { currentUser, postId, existingPost };
}
