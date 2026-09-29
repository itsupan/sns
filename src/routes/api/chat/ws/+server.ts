import type { RequestHandler } from './$types';
import * as v from 'valibot';
import { ApiError, parseQuery, requireUser, withApi } from '$lib/server/api';
import { requireMembership } from '$lib/server/db/chat';
import { chatRoom } from '$lib/server/chat/rooms';

/**
 * Upgrades to a WebSocket on the conversation's ChatRoom after checking the session and
 * membership. Query: `conversationId`. The room only pushes events; messages are sent over HTTP.
 */
export const GET: RequestHandler = withApi(async ({ url, request, locals, platform }) => {
	const viewer = requireUser(locals);
	if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
		throw new ApiError(426, 'upgrade_required', 'Expected a WebSocket upgrade');
	}
	const { conversationId } = await parseQuery(
		url,
		v.object({ conversationId: v.pipe(v.string(), v.minLength(1, 'Conversation is required')) })
	);
	await requireMembership(locals.db, conversationId, viewer.id);

	const room = chatRoom(platform, conversationId);
	if (!room) throw new ApiError(503, 'chat_unavailable', 'Live chat is unavailable right now');

	return room.fetch('https://chat-room/connect', {
		headers: { Upgrade: 'websocket', 'x-user-id': viewer.id }
	});
});
