import { ApiError } from '$lib/server/api';
import { isFollowing } from '$lib/server/db/follows';
import { getStory, parseStoryId, type StoredStory } from '$lib/server/stories';

/**
 * The live story `id` when `viewerId` can see it: their own, or one by someone they follow (a
 * block removes the follow, so blocked users never qualify). Anything else is a 404.
 */
export async function requireVisibleStory(
	locals: App.Locals,
	platform: App.Platform | undefined,
	id: string,
	viewerId: string
): Promise<{ kv: KVNamespace; story: StoredStory }> {
	if (!parseStoryId(id)) {
		throw new ApiError(400, 'validation_failed', 'Invalid story id');
	}
	const kv = platform?.env?.STORIES;
	if (!kv) {
		throw new ApiError(503, 'stories_unavailable', 'Stories are not available right now');
	}
	const story = await getStory(kv, id);
	const canSee =
		story && (story.userId === viewerId || (await isFollowing(locals.db, viewerId, story.userId)));
	if (!story || !canSee) {
		throw new ApiError(404, 'not_found', 'Story not found');
	}
	return { kv, story };
}
