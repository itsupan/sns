import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { ApiError, enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';
import { notifyStatement, unnotifyStatement } from '$lib/server/db/notifications';
import { recordViewStatements, setReactionStatement } from '$lib/server/stories';
import { requireVisibleStory } from '$lib/server/story-access';
import { STORY_REACTIONS } from '$lib/reactions';

const ReactBody = v.object(
	{ reaction: v.nullable(v.picklist(STORY_REACTIONS, 'Invalid reaction')) },
	'Request body must be an object'
);

/**
 * Sets the viewer's reaction on a story (`reaction: null` clears it) and notifies the author.
 * Reacting again replaces the previous reaction; reacting counts as watching.
 */
export const POST: RequestHandler = withApi(async ({ params, request, locals, platform }) => {
	const viewer = requireUser(locals);
	await enforceRateLimit(platform, 'storyReaction', viewer.id);
	const { reaction } = await parseBody(request, ReactBody);
	const story = await requireVisibleStory(locals, params.id ?? '', viewer.id);
	if (story.userId === viewer.id) {
		throw new ApiError(400, 'validation_failed', 'You cannot react to your own story');
	}

	const notice = {
		type: 'story_reaction',
		actorId: viewer.id,
		recipientId: story.userId,
		storyId: story.id
	} as const;
	await locals.db.batch([
		...recordViewStatements(locals.db, story.id, viewer.id),
		setReactionStatement(locals.db, story.id, viewer.id, reaction),
		reaction ? notifyStatement(locals.db, notice) : unnotifyStatement(locals.db, notice)
	]);
	return json({ reaction });
});
