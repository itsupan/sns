import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { enforceRateLimit, parseBody, parsePageQuery, requireUser, withApi } from '$lib/server/api';
import { withFreshAvatars } from '$lib/server/api/comments';
import { getConfig } from '$lib/server/config';
import { createComment, listPostComments } from '$lib/server/db/comments';

const CreateComment = v.object({
	content: v.pipe(
		v.string('Comment content is required'),
		v.trim(),
		v.minLength(1, 'Comment content is required'),
		v.maxLength(1000, 'Comment cannot exceed 1000 characters')
	),
	/** Reply to this top-level comment (replies are one level deep). */
	parentCommentId: v.optional(
		v.nullable(v.pipe(v.string('Invalid parent comment'), v.minLength(1, 'Invalid parent comment')))
	)
});

/** Top-level comments, oldest first, each with `repliesCount` and `reactions`. Query: `limit`, `cursor`. */
export const GET: RequestHandler = withApi(async ({ params, url, locals, platform }) => {
	const { limit, cursor } = await parsePageQuery(url, getConfig(platform?.env).comments);
	const page = await listPostComments(locals.db, {
		postId: params.id,
		viewerId: locals.user?.id ?? null,
		limit,
		cursor
	});
	return json({
		comments: await withFreshAvatars(page.comments, platform?.env),
		hasMore: page.hasMore,
		nextCursor: page.nextCursor
	});
});

/** Adds a comment, or a reply when `parentCommentId` is set. */
export const POST: RequestHandler = withApi(async ({ params, request, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'comment', currentUser.id);
	const { content, parentCommentId } = await parseBody(request, CreateComment);

	const result = await createComment(locals.db, {
		postId: params.id,
		author: currentUser,
		content,
		parentCommentId
	});
	const [comment] = await withFreshAvatars([result.comment], platform?.env);

	return json({ ...result, comment }, { status: 201 });
});
