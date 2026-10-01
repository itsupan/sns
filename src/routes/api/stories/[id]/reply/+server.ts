import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { ApiError, enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';
import { getOrCreateDm, sendMessage } from '$lib/server/db/chat';
import { broadcastLater } from '$lib/server/chat/rooms';
import { requireVisibleStory } from '$lib/server/story-access';
import { MAX_MESSAGE_LENGTH } from '$lib/chat/types';

const ReplyBody = v.object(
	{
		content: v.pipe(
			v.string('Reply is required'),
			v.trim(),
			v.minLength(1, 'Reply is required'),
			v.maxLength(MAX_MESSAGE_LENGTH, `Reply cannot exceed ${MAX_MESSAGE_LENGTH} characters`)
		)
	},
	'Request body must be an object'
);

/**
 * Replies to a story with a direct message to its author, linked to the story so the chat can
 * show what it answers. 403 when either user blocked the other.
 */
export const POST: RequestHandler = withApi(async ({ params, request, locals, platform }) => {
	const viewer = requireUser(locals);
	await enforceRateLimit(platform, 'chatMessage', viewer.id);
	const { content } = await parseBody(request, ReplyBody);
	const { story } = await requireVisibleStory(locals, platform, params.id ?? '', viewer.id);
	if (story.userId === viewer.id) {
		throw new ApiError(400, 'validation_failed', 'You cannot reply to your own story');
	}

	const dm = await getOrCreateDm(locals.db, viewer.id, story.userId);
	const { message } = await sendMessage(locals.db, {
		conversationId: dm.id,
		senderId: viewer.id,
		content,
		storyRef: story.id
	});
	broadcastLater(platform, dm.id, { type: 'message', message });
	return json({ conversationId: dm.id, message }, { status: 201 });
});
