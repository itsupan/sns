import { json } from '@sveltejs/kit';
import { eq, asc } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { post, postComment, user } from '$lib/server/db/schema';
import * as v from 'valibot';
import { formatTimeAgo } from '$lib/utils/format';
import { apiError, enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';
import { commentsCountOf } from '$lib/server/db/counters';

const CreateComment = v.object({
	content: v.pipe(
		v.string('Comment content is required'),
		v.trim(),
		v.minLength(1, 'Comment content is required'),
		v.maxLength(1000, 'Comment cannot exceed 1000 characters')
	)
});

export const GET: RequestHandler = withApi(async ({ params, locals }) => {
	const postId = params.id;
	if (!postId) {
		return apiError(400, 'bad_request', 'Post ID is required');
	}

	const commentRows = await locals.db
		.select({
			id: postComment.id,
			content: postComment.content,
			createdAt: postComment.createdAt,
			user: {
				id: user.id,
				name: user.name,
				handle: user.handle,
				image: user.image
			}
		})
		.from(postComment)
		.innerJoin(user, eq(postComment.userId, user.id))
		.where(eq(postComment.postId, postId))
		.orderBy(asc(postComment.createdAt));

	const comments = commentRows.map((r) => ({
		id: r.id,
		content: r.content,
		createdAt: r.createdAt,
		timeAgo: formatTimeAgo(r.createdAt),
		author: {
			id: r.user.id,
			name: r.user.name,
			handle: r.user.handle
				? `@${r.user.handle.replace(/^@/, '')}`
				: `@${r.user.name.toLowerCase().replace(/\s+/g, '')}`,
			avatar: r.user.image || ''
		}
	}));

	return json({ comments });
});

export const POST: RequestHandler = withApi(async ({ params, request, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'comment', currentUser.id);

	const postId = params.id;
	if (!postId) {
		return apiError(400, 'bad_request', 'Post ID is required');
	}

	const { content } = await parseBody(request, CreateComment);

	const postRows = await locals.db
		.select({ id: post.id })
		.from(post)
		.where(eq(post.id, postId))
		.limit(1);

	if (postRows.length === 0) {
		return apiError(404, 'not_found', 'Post not found');
	}

	const commentId = crypto.randomUUID();

	const [, updated] = await locals.db.batch([
		locals.db.insert(postComment).values({
			id: commentId,
			postId,
			userId: currentUser.id,
			content
		}),
		locals.db
			.update(post)
			.set({ commentsCount: commentsCountOf(postId), updatedAt: new Date() })
			.where(eq(post.id, postId))
			.returning({ commentsCount: post.commentsCount })
	]);
	const nextCommentsCount = updated[0]?.commentsCount ?? 0;

	const createdComment = {
		id: commentId,
		content,
		createdAt: new Date(),
		timeAgo: 'Just now',
		author: {
			id: currentUser.id,
			name: currentUser.name,
			handle: currentUser.handle
				? `@${currentUser.handle.replace(/^@/, '')}`
				: `@${currentUser.name.toLowerCase().replace(/\s+/g, '')}`,
			avatar: currentUser.image || ''
		}
	};

	return json({ comment: createdComment, commentsCount: nextCommentsCount }, { status: 201 });
});
