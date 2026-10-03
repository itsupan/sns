import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';
import { StoryId } from '$lib/server/api/highlights';
import { addHighlightItem, removeHighlightItem } from '$lib/server/highlights';

const ItemBody = v.object({ storyId: StoryId }, 'Request body must be an object');

/** Adds one of your stories, live or expired, to the end of your highlight. Idempotent. */
export const POST: RequestHandler = withApi(async ({ params, request, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'highlight', currentUser.id);
	const { storyId } = await parseBody(request, ItemBody);
	await addHighlightItem(locals.db, currentUser.id, params.id, storyId);
	return new Response(null, { status: 204 });
});

/** Takes a story out of your highlight; it stays in your archive. Idempotent. */
export const DELETE: RequestHandler = withApi(async ({ params, request, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'highlight', currentUser.id);
	const { storyId } = await parseBody(request, ItemBody);
	await removeHighlightItem(locals.db, currentUser.id, params.id, storyId);
	return new Response(null, { status: 204 });
});
