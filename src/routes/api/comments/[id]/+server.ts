import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser, withApi } from '$lib/server/api';
import { deleteComment } from '$lib/server/db/comments';

/**
 * Deletes a comment and its replies. Allowed for the comment's author and the post's author.
 * Returns the post's new `commentsCount` and, for a reply, the parent's new `repliesCount`.
 */
export const DELETE: RequestHandler = withApi(async ({ params, locals }) => {
	const currentUser = requireUser(locals);
	const result = await deleteComment(locals.db, { commentId: params.id, userId: currentUser.id });
	return json(result);
});
