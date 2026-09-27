import { json } from '@sveltejs/kit';
import { eq, asc } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { post, postComment, user } from '$lib/server/db/schema';
import { formatTimeAgo } from '$lib/utils/format';

export const GET: RequestHandler = async ({ params, locals }) => {
	const postId = params.id;
	if (!postId) {
		return json({ error: 'Post ID is required' }, { status: 400 });
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
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const postId = params.id;
	if (!postId) {
		return json({ error: 'Post ID is required' }, { status: 400 });
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON payload' }, { status: 400 });
	}

	const content = typeof body.content === 'string' ? body.content.trim() : '';
	if (!content) {
		return json({ error: 'Comment content is required' }, { status: 400 });
	}

	if (content.length > 1000) {
		return json({ error: 'Comment cannot exceed 1000 characters' }, { status: 400 });
	}

	const postRows = await locals.db
		.select({ id: post.id, commentsCount: post.commentsCount })
		.from(post)
		.where(eq(post.id, postId))
		.limit(1);

	if (postRows.length === 0) {
		return json({ error: 'Post not found' }, { status: 404 });
	}

	const targetPost = postRows[0];
	const commentId = crypto.randomUUID();

	await locals.db.insert(postComment).values({
		id: commentId,
		postId,
		userId: locals.user.id,
		content
	});

	const nextCommentsCount = targetPost.commentsCount + 1;
	await locals.db
		.update(post)
		.set({ commentsCount: nextCommentsCount, updatedAt: new Date() })
		.where(eq(post.id, postId));

	const createdComment = {
		id: commentId,
		content,
		createdAt: new Date(),
		timeAgo: 'Just now',
		author: {
			id: locals.user.id,
			name: locals.user.name,
			handle: locals.user.handle
				? `@${locals.user.handle.replace(/^@/, '')}`
				: `@${locals.user.name.toLowerCase().replace(/\s+/g, '')}`,
			avatar: locals.user.image || ''
		}
	};

	return json({ comment: createdComment, commentsCount: nextCommentsCount }, { status: 201 });
};
