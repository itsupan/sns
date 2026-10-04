import { error } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { post, user } from '$lib/server/db/schema';
import { loadSuggestions } from '$lib/server/explore';
import { refreshPostMediaUrls } from '$lib/server/services/storage';
import { notDeleted } from '$lib/server/db/posts';
import { postRowAuthor, toPostCards } from '$lib/server/db/post-cards';
import { notBlockedWith } from '$lib/server/db/blocks';
import { notPrivateTo } from '$lib/server/db/visibility';

export const load: PageServerLoad = async ({ params, locals, url, platform }) => {
	const [row] = await locals.db
		.select({
			post,
			user: postRowAuthor,
			visible: notPrivateTo(locals.user?.id, post.userId).mapWith(Boolean)
		})
		.from(post)
		.innerJoin(user, eq(post.userId, user.id))
		.where(and(eq(post.id, params.id), notDeleted, notBlockedWith(locals.user?.id, post.userId)))
		.limit(1);

	if (!row) {
		throw error(404, 'Post not found');
	}
	// The post exists, but its author is a private account the viewer does not follow.
	if (!row.visible) {
		throw error(403, 'This account is private');
	}

	// Count an impression when someone other than the author opens the post.
	if (locals.user?.id !== row.post.userId) {
		try {
			await locals.db
				.update(post)
				.set({ viewsCount: sql`${post.viewsCount} + 1` })
				.where(eq(post.id, row.post.id));
		} catch (err) {
			console.error('Failed to count post view:', err);
		}
	}

	const [postData] = await toPostCards(locals.db, [row], locals.user?.id);

	const origin =
		url.origin && !url.origin.includes('localhost') && !url.origin.includes('127.0.0.1')
			? url.origin
			: platform?.env?.BETTER_AUTH_URL || url.origin;

	const refreshedPost = await refreshPostMediaUrls(postData, platform?.env);

	return {
		post: refreshedPost,
		postUrl: `${origin}/post/${refreshedPost.id}`,
		origin,
		// The sidebar is optional: a failure here must not take the post down.
		suggestions: await loadSuggestions(locals.db, locals.user?.id, platform?.env).catch(() => [])
	};
};
