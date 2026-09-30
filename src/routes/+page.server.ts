import type { PageServerLoad } from './$types';
import { refreshPostMediaUrls } from '$lib/server/services/storage';
import { loadFeedPage } from '$lib/server/db/posts';
import { toPostCards } from '$lib/server/db/post-cards';
import { getConfig } from '$lib/server/config';

export const load: PageServerLoad = async ({ locals, platform }) => {
	const pageSize = getConfig(platform?.env).feed.defaultPageSize;
	try {
		const page = await loadFeedPage(locals.db, { limit: pageSize });
		const posts = await toPostCards(locals.db, page.rows, locals.user?.id);

		const refreshedPosts = await Promise.all(
			posts.map((p) => refreshPostMediaUrls(p, platform?.env))
		);

		return {
			posts: refreshedPosts,
			hasMore: page.hasMore,
			nextCursor: page.nextCursor,
			pageSize,
			loadFailed: false
		};
	} catch (err) {
		console.error('Failed to load feed posts from database:', err);
		return { posts: [], hasMore: false, nextCursor: null, pageSize, loadFailed: true };
	}
};
