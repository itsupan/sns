import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ApiError, requireUser, withApi } from '$lib/server/api';
import { isFollowing } from '$lib/server/db/follows';
import { getStory, parseStoryId, recordView } from '$lib/server/stories';

/**
 * Marks a story as watched by the signed-in user. Idempotent; opening your own story is not
 * counted. Only people who can see the story (its author's followers) can view it.
 */
export const POST: RequestHandler = withApi(async ({ params, locals, platform }) => {
	const viewer = requireUser(locals);
	const id = params.id ?? '';
	const parsed = parseStoryId(id);
	if (!parsed) {
		throw new ApiError(400, 'validation_failed', 'Invalid story id');
	}
	const kv = platform?.env?.STORIES;
	if (!kv) {
		throw new ApiError(503, 'stories_unavailable', 'Stories are not available right now');
	}

	const story = await getStory(kv, id);
	const canSee =
		story &&
		(story.userId === viewer.id || (await isFollowing(locals.db, viewer.id, story.userId)));
	if (!story || !canSee) {
		throw new ApiError(404, 'not_found', 'Story not found');
	}

	const counted = await recordView(kv, story, viewer.id);
	return json({ counted });
});
