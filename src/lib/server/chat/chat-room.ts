/*
 * One Durable Object per conversation, holding its members' WebSockets with the Hibernation
 * API (idle rooms cost nothing). Messages are stored in D1 by the HTTP API first and then
 * pushed here with `broadcast`, so a message nobody saw live is never lost.
 * Exported from worker.ts at the repo root; keep imports relative (wrangler bundles this, not SvelteKit).
 */
import { DurableObject } from 'cloudflare:workers';
import type { ChatServerEvent } from '../../chat/types';
import { broadcast, handleClientFrame, type SocketAttachment } from './protocol';

export class ChatRoom extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		// Heartbeats are answered by the runtime without waking the object.
		ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
	}

	/** Accepts a WebSocket for an already-authorized member (`x-user-id` set by the API). */
	async fetch(request: Request): Promise<Response> {
		const userId = request.headers.get('x-user-id');
		if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket' || !userId) {
			return new Response('Expected a WebSocket upgrade', { status: 426 });
		}
		const { 0: client, 1: server } = new WebSocketPair();
		this.ctx.acceptWebSocket(server, [userId]);
		server.serializeAttachment({ userId, lastTypingAt: 0 } satisfies SocketAttachment);
		return new Response(null, { status: 101, webSocket: client });
	}

	/** RPC from the API after a message is stored. */
	broadcast(event: ChatServerEvent): void {
		broadcast(this.ctx.getWebSockets(), event);
	}

	webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): void {
		handleClientFrame(ws, data, this.ctx.getWebSockets());
	}

	webSocketClose(ws: WebSocket, code: number, reason: string): void {
		try {
			ws.close(code === 1005 ? 1000 : code, reason);
		} catch {
			// Already closed.
		}
	}
}
