import { json } from '@sveltejs/kit';
import { eq, sql, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { post, postShare } from '$lib/server/db/schema';
import { apiError, enforceRateLimit, requireUser, withApi } from '$lib/server/api';
import { notDeleted, requireVisiblePost } from '$lib/server/db/posts';
import { requireNotBlocked } from '$lib/server/db/blocks';

export const POST: RequestHandler = withApi(async ({ params, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'share', currentUser.id);

	const postId = params.id;
	if (!postId) {
		return apiError(400, 'bad_request', 'Post ID is required');
	}

	const target = await requireVisiblePost(locals.db, currentUser.id, postId);
	await requireNotBlocked(locals.db, currentUser.id, target.authorId, 'You cannot share this post');

	// Only a user's first share of a post counts. One batch (one transaction): `changes()` is the
	// number of rows the insert just before added, 0 when this user had already shared the post.
	const [, updated] = await locals.db.batch([
		locals.db.insert(postShare).values({ userId: currentUser.id, postId }).onConflictDoNothing(),
		locals.db
			.update(post)
			.set({ sharesCount: sql`${post.sharesCount} + 1`, updatedAt: new Date() })
			.where(and(eq(post.id, postId), notDeleted, sql`changes() > 0`))
			.returning({ sharesCount: post.sharesCount })
	]);

	return json({ sharesCount: updated[0]?.sharesCount ?? target.sharesCount });
});
