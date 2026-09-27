import { json } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { post, postLike } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const postId = params.id;
	if (!postId) {
		return json({ error: 'Post ID is required' }, { status: 400 });
	}

	const postRows = await locals.db
		.select({ id: post.id, likesCount: post.likesCount })
		.from(post)
		.where(eq(post.id, postId))
		.limit(1);

	if (postRows.length === 0) {
		return json({ error: 'Post not found' }, { status: 404 });
	}

	const targetPost = postRows[0];

	// Check if already liked
	const existingLike = await locals.db
		.select({ id: postLike.id })
		.from(postLike)
		.where(and(eq(postLike.postId, postId), eq(postLike.userId, locals.user.id)))
		.limit(1);

	if (existingLike.length > 0) {
		// Unlike
		await locals.db
			.delete(postLike)
			.where(and(eq(postLike.postId, postId), eq(postLike.userId, locals.user.id)));

		const nextLikesCount = Math.max(0, targetPost.likesCount - 1);
		await locals.db
			.update(post)
			.set({ likesCount: nextLikesCount, updatedAt: new Date() })
			.where(eq(post.id, postId));

		return json({ liked: false, likesCount: nextLikesCount });
	} else {
		// Like
		await locals.db.insert(postLike).values({
			id: crypto.randomUUID(),
			postId,
			userId: locals.user.id
		});

		const nextLikesCount = targetPost.likesCount + 1;
		await locals.db
			.update(post)
			.set({ likesCount: nextLikesCount, updatedAt: new Date() })
			.where(eq(post.id, postId));

		return json({ liked: true, likesCount: nextLikesCount });
	}
};
