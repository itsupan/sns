/** Longest direct message, shared by the API (validation) and the composer. */
export const MAX_MESSAGE_LENGTH = 2000;

export interface ChatMessage {
	id: string;
	conversationId: string;
	senderId: string;
	content: string;
	/** Epoch ms assigned by D1, so every message in a conversation shares one clock. */
	createdAt: number;
}

export interface ChatUser {
	id: string;
	name: string;
	handle: string;
	/** Profile path segment: the handle when set, otherwise the id. */
	slug: string;
	image: string | null;
}

export interface InboxItem {
	id: string;
	other: ChatUser;
	lastMessage: { content: string; senderId: string; createdAt: number } | null;
	unreadCount: number;
}

/** Server → client WebSocket events. */
export type ChatServerEvent =
	{ type: 'message'; message: ChatMessage } | { type: 'typing'; userId: string };

/** Client → server WebSocket events. Plain "ping" text frames get "pong" (heartbeat). */
export type ChatClientEvent = { type: 'typing' };
