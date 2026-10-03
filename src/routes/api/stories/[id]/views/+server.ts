import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ApiError, parsePageQuery, requireUser, withApi } from '$lib/server/api';
import { getConfig } from '$lib/server/config';
import { refreshMediaUrl } from '$lib/server/services/storage';
import { getLiveStory, loadViewersPage, parseStoryId } from '$lib/server/stories';

/**
 * Who watched your story, most recent first, with any reaction they sent, one page at a time.
 * `count` is the story's total views. Author only.
 */
export const GET: RequestHandler = withApi(async ({ params, url, locals, platform }) => {
	const currentUser = requireUser(locals);
	const id = params.id ?? '';
	const parsed = parseStoryId(id);
	if (!parsed) {
		throw new ApiError(400, 'validation_failed', 'Invalid story id');
	}
	if (parsed.userId !== currentUser.id) {
		throw new ApiError(403, 'forbidden', 'Only the author can see who viewed a story');
	}
	const { limit, cursor } = await parsePageQuery(url, getConfig(platform?.env).storyViewers);
	const story = await getLiveStory(locals.db, id);
	if (!story) {
		throw new ApiError(404, 'not_found', 'Story not found');
	}

	const page = await loadViewersPage(locals.db, id, currentUser.id, { limit, cursor });
	const viewers = await Promise.all(
		page.viewers.map(async (person) => ({
			...person,
			image: person.image ? await refreshMediaUrl(person.image, platform?.env) : null
		}))
	);
	return json({ count: story.viewsCount, viewers, nextCursor: page.nextCursor });
});
