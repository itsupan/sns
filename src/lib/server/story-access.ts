import { ApiError } from '$lib/server/api';
import type { Database } from '$lib/server/db';
import { isCloseFriend } from '$lib/server/db/close-friends';
import { isFollowing } from '$lib/server/db/follows';
import { getLiveStory, parseStoryId, type StoredStory } from '$lib/server/stories';

async function canSee(db: Database, story: StoredStory, viewerId: string) {
	if (story.userId === viewerId) return true;
	const [follows, listed] = await Promise.all([
		isFollowing(db, viewerId, story.userId),
		story.audience === 'everyone' || isCloseFriend(db, story.userId, viewerId)
	]);
	return follows && listed;
}

/**
 * The live story `id` when `viewerId` can see it: their own, or one by someone they follow (a
 * block removes the follow, so blocked users never qualify) and, for a close friends story, whose
 * list they are on. Anything else is a 404.
 */
export async function requireVisibleStory(
	locals: App.Locals,
	id: string,
	viewerId: string
): Promise<StoredStory> {
	if (!parseStoryId(id)) {
		throw new ApiError(400, 'validation_failed', 'Invalid story id');
	}
	const story = await getLiveStory(locals.db, id);
	if (!story || !(await canSee(locals.db, story, viewerId))) {
		throw new ApiError(404, 'not_found', 'Story not found');
	}
	return story;
}
