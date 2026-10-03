import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { user } from '$lib/server/db/schema';
import { ApiError, withApi } from '$lib/server/api';
import { loadHighlights } from '$lib/server/highlights';
import { withSignedMedia } from '$lib/server/stories';

/**
 * `:id`'s story highlights, newest first, with the stories the viewer may see (see
 * `loadHighlights`). Watching them records no views, and they never expire.
 */
export const GET: RequestHandler = withApi(async ({ params, locals, platform }) => {
	const [owner] = await locals.db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.id, params.id))
		.limit(1);
	if (!owner) throw new ApiError(404, 'not_found', 'User not found');

	const highlights = await loadHighlights(locals.db, owner.id, locals.user?.id);
	return json({
		highlights: await Promise.all(
			highlights.map(async (h) => ({
				...h,
				stories: await withSignedMedia(h.stories, platform?.env)
			}))
		)
	});
});
