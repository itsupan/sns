import type { RequestHandler } from './$types';
import { ApiError, enforceRateLimit, requireUser, withApi } from '$lib/server/api';
import { deleteMediaObjects, ownedMediaKeys } from '$lib/server/services/storage';
import { deleteStory, parseStoryId } from '$lib/server/stories';

/**
 * Deletes one of your own stories (its views, reaction notifications and media too) before it
 * expires. `:id` is `<userId>:<ms>`. Idempotent: a story already gone is a 204 as well.
 */
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

	const mediaUrl = await deleteStory(locals.db, id, currentUser.id);
	const mediaKeys = mediaUrl ? ownedMediaKeys([mediaUrl], currentUser.id) : [];
	if (mediaKeys.length > 0) {
		const cleanup = deleteMediaObjects(mediaKeys, platform?.env);
		if (platform?.ctx?.waitUntil) {
			platform.ctx.waitUntil(cleanup);
		} else {
			await cleanup;
		}
	}
	return new Response(null, { status: 204 });
});
