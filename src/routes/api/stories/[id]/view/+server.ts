import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { enforceRateLimit, requireUser, withApi } from '$lib/server/api';
import { recordView } from '$lib/server/stories';
import { requireVisibleStory } from '$lib/server/story-access';

/**
 * Marks a story as watched by the signed-in user. Idempotent; opening your own story is not
 * counted. Only people who can see the story (its author's followers) can view it.
 */
export const POST: RequestHandler = withApi(async ({ params, locals, platform }) => {
	const viewer = requireUser(locals);
	await enforceRateLimit(platform, 'storyView', viewer.id);
	const { kv, story } = await requireVisibleStory(locals, platform, params.id ?? '', viewer.id);
	const counted = await recordView(kv, story, viewer.id);
	return json({ counted });
});
