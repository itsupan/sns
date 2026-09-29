/*
 * ChatRoom logic without Workers runtime imports, so it runs in unit tests. Keep this file free
 * of `$lib` aliases: it is bundled by wrangler (via worker.ts), not by SvelteKit.
 */
import type { ChatServerEvent } from '../../chat/types';

/** Relay a member's typing signal to the others at most this often. */
export const TYPING_RELAY_INTERVAL_MS = 1500;

/** Per-socket state kept with `serializeAttachment`, so it survives hibernation. */
export interface SocketAttachment {
	userId: string;
	lastTypingAt: number;
}

/** The part of a hibernatable WebSocket the room logic needs. */
export interface RoomSocket {
	send(data: string): void;
	deserializeAttachment(): unknown;
	serializeAttachment(value: unknown): void;
}

export function attachmentOf(ws: RoomSocket): SocketAttachment | null {
	const value = ws.deserializeAttachment() as Partial<SocketAttachment> | null;
	return value && typeof value.userId === 'string'
		? { userId: value.userId, lastTypingAt: value.lastTypingAt ?? 0 }
		: null;
}

/** Sends `event` to every socket except `exclude`; a socket that fails to send is skipped. */
export function broadcast(
	sockets: Iterable<RoomSocket>,
	event: ChatServerEvent,
	exclude?: RoomSocket
) {
	const data = JSON.stringify(event);
	for (const ws of sockets) {
		if (ws === exclude) continue;
		try {
			ws.send(data);
		} catch {
			// Closing or already closed; the runtime will deliver webSocketClose.
		}
	}
}

/**
 * Handles a client frame. Only `{"type":"typing"}` is accepted: it is relayed to the other
 * members' sockets (never back to the sender's own tabs), throttled per socket. Anything
 * else is ignored; messages are sent over HTTP so they are stored before anyone sees them.
 */
export function handleClientFrame(
	ws: RoomSocket,
	raw: string | ArrayBuffer,
	sockets: Iterable<RoomSocket>,
	now = Date.now()
): void {
	if (typeof raw !== 'string' || raw.length > 256) return;
	let frame: unknown;
	try {
		frame = JSON.parse(raw);
	} catch {
		return;
	}
	if ((frame as { type?: unknown })?.type !== 'typing') return;

	const self = attachmentOf(ws);
	if (!self || now - self.lastTypingAt < TYPING_RELAY_INTERVAL_MS) return;
	ws.serializeAttachment({ ...self, lastTypingAt: now } satisfies SocketAttachment);

	const others = [...sockets].filter((s) => attachmentOf(s)?.userId !== self.userId);
	broadcast(others, { type: 'typing', userId: self.userId });
}
