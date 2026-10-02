import { CONVERSATION_CLOSED_CODE, type ChatServerEvent } from '$lib/chat/types';
import type { ChatRoom } from './chat-room';

/**
 * The conversation's ChatRoom stub, or null when the binding is unavailable (`vite dev` and
 * unit tests, where the class is not exported by the served worker; chat then works over HTTP).
 */
export function chatRoom(platform: App.Platform | undefined, conversationId: string) {
	const ns = platform?.env?.CHAT_ROOM as DurableObjectNamespace<ChatRoom> | undefined;
	if (!ns) return null;
	try {
		return ns.get(ns.idFromName(conversationId));
	} catch {
		return null;
	}
}

/**
 * Pushes `event` to the conversation's open sockets after the response is sent. Best effort:
 * the message is already in D1, and clients catch up on reconnect.
 */
export function broadcastLater(
	platform: App.Platform | undefined,
	conversationId: string,
	event: ChatServerEvent
) {
	const room = chatRoom(platform, conversationId);
	if (!room) return;
	const delivery = room.broadcast(event).catch((err: unknown) => {
		console.warn('[chat] broadcast failed', err);
	});
	if (platform?.ctx?.waitUntil) platform.ctx.waitUntil(delivery);
}

/** Disconnects everyone from the conversation's room after the response is sent. Best effort. */
export function closeRoomLater(platform: App.Platform | undefined, conversationId: string) {
	const room = chatRoom(platform, conversationId);
	if (!room) return;
	const closing = room
		.closeAll(CONVERSATION_CLOSED_CODE, 'Conversation closed')
		.catch((err: unknown) => {
			console.warn('[chat] closing room failed', err);
		});
	if (platform?.ctx?.waitUntil) platform.ctx.waitUntil(closing);
}
