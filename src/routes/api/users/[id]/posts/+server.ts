import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { user } from '$lib/server/db/schema';
import { getConfig } from '$lib/server/config';
import { loadProfilePosts, toGridItem } from '$lib/server/db/profiles';
import { refreshPostMediaUrls } from '$lib/server/services/storage';
import { ApiError, parsePageQuery, withApi } from '$lib/server/api';

/**
 * `:id`'s posts as profile grid items, newest first: the pages after the profile page's first.
 * Like the profile page, a block in either direction leaves them out.
 */
export const GET: RequestHandler = withApi(async ({ params, url, locals, platform }) => {
	const { limit, cursor } = await parsePageQuery(url, getConfig(platform?.env).profile);
	const [author] = await locals.db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.id, params.id))
		.limit(1);
	if (!author) throw new ApiError(404, 'not_found', 'User not found');

	const page = await loadProfilePosts(locals.db, author.id, locals.user?.id, { limit, cursor });
	const posts = await Promise.all(
		page.posts.map(async (p) => toGridItem(await refreshPostMediaUrls(p, platform?.env)))
	);
	return json({ posts, nextCursor: page.nextCursor });
});
