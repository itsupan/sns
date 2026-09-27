import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { post } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ params, locals }) => {
	const postId = params.id;
	if (!postId) {
		return json({ error: 'Post ID is required' }, { status: 400 });
	}

	const postRows = await locals.db
		.select({ id: post.id, sharesCount: post.sharesCount })
		.from(post)
		.where(eq(post.id, postId))
		.limit(1);

	if (postRows.length === 0) {
		return json({ error: 'Post not found' }, { status: 404 });
	}

	const nextSharesCount = postRows[0].sharesCount + 1;
	await locals.db
		.update(post)
		.set({ sharesCount: nextSharesCount, updatedAt: new Date() })
		.where(eq(post.id, postId));

	return json({ sharesCount: nextSharesCount });
};
