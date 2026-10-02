import type { RequestHandler } from './$types';
import { ApiError, enforceRateLimit, requireUser, withApi } from '$lib/server/api';
import { deleteStory, parseStoryId } from '$lib/server/stories';

/** Deletes one of your own stories (and its views) before it expires. `:id` is `<userId>:<ms>`. */
export const DELETE: RequestHandler = withApi(async ({ params, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'contentEdit', currentUser.id);
	const id = params.id ?? '';
	const parsed = parseStoryId(id);
	if (!parsed) {
		throw new ApiError(400, 'validation_failed', 'Invalid story id');
	}
	if (parsed.userId !== currentUser.id) {
		throw new ApiError(403, 'forbidden', 'You can only delete your own stories');
	}
	const kv = platform?.env?.STORIES;
	if (!kv) {
		throw new ApiError(503, 'stories_unavailable', 'Stories are not available right now');
	}
	// KV deletes are idempotent: an already-expired story is simply gone.
	await deleteStory(kv, id);
	return new Response(null, { status: 204 });
});
