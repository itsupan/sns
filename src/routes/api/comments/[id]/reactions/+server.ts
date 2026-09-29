import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';
import { toggleReaction } from '$lib/server/db/comments';
import { COMMENT_REACTIONS } from '$lib/reactions';

const ToggleReaction = v.object({
	type: v.picklist(COMMENT_REACTIONS, `Reaction must be one of: ${COMMENT_REACTIONS.join(', ')}`)
});

/** Toggles the viewer's reaction of `type`; returns whether it is now on and the comment's summary. */
export const POST: RequestHandler = withApi(async ({ params, request, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'reaction', currentUser.id);
	const { type } = await parseBody(request, ToggleReaction);
	return json(
		await toggleReaction(locals.db, { commentId: params.id, userId: currentUser.id, type })
	);
});
