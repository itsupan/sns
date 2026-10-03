import { json } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { post, postLike } from '$lib/server/db/schema';
import { apiError, enforceRateLimit, requireUser, withApi } from '$lib/server/api';
import { likesCountOf } from '$lib/server/db/counters';
import { requireVisiblePost } from '$lib/server/db/posts';
import { requireNotBlocked } from '$lib/server/db/blocks';
import { notifyStatement, unnotifyStatement } from '$lib/server/db/notifications';

export const POST: RequestHandler = withApi(async ({ params, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'like', currentUser.id);

	const postId = params.id;
	if (!postId) {
		return apiError(400, 'bad_request', 'Post ID is required');
	}

	const { authorId } = await requireVisiblePost(locals.db, currentUser.id, postId);

	const ownLike = and(eq(postLike.postId, postId), eq(postLike.userId, currentUser.id));
	const existingLike = await locals.db
		.select({ id: postLike.id })
		.from(postLike)
		.where(ownLike)
		.limit(1);
	const liked = existingLike.length === 0;
	if (liked) {
		await requireNotBlocked(locals.db, currentUser.id, authorId, 'You cannot like this post');
	}

	const toggle = liked
		? locals.db
				.insert(postLike)
				.values({ id: crypto.randomUUID(), postId, userId: currentUser.id })
				.onConflictDoNothing()
		: locals.db.delete(postLike).where(ownLike);

	const target = {
		type: 'like',
		actorId: currentUser.id,
		recipientId: authorId,
		postId
	} as const;
	const [, , updated] = await locals.db.batch([
		toggle,
		liked ? notifyStatement(locals.db, target) : unnotifyStatement(locals.db, target),
		locals.db
			.update(post)
			.set({ likesCount: likesCountOf(postId), updatedAt: new Date() })
			.where(eq(post.id, postId))
			.returning({ likesCount: post.likesCount })
	]);

	return json({ liked, likesCount: updated[0]?.likesCount ?? 0 });
});
