import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONVERSATION_CLOSED_CODE, TOO_MANY_SOCKETS_CODE } from '$lib/chat/types';
import { ChatRoom } from './chat-room';
import { MAX_SOCKETS_PER_USER } from './protocol';

vi.mock('cloudflare:workers', () => ({
	DurableObject: class {
		constructor(
			readonly ctx: unknown,
			readonly env: unknown
		) {}
	}
}));

/** A hibernatable WebSocket as the room sees it. */
class FakeSocket {
	sent: string[] = [];
	closed: { code: number; reason: string } | null = null;
	private attachment: unknown = null;

	send(data: string) {
		if (this.closed) throw new Error('closed');
		this.sent.push(data);
	}
	close(code: number, reason: string) {
		if (this.closed) throw new Error('already closed');
		this.closed = { code, reason };
	}
	serializeAttachment(value: unknown) {
		this.attachment = structuredClone(value);
	}
	deserializeAttachment() {
		return this.attachment;
	}
}

/** The hibernation API of `DurableObjectState` that the room uses: sockets tagged by user id. */
class FakeState {
	readonly accepted: { ws: FakeSocket; tags: string[] }[] = [];
	autoResponse: unknown;

	setWebSocketAutoResponse(pair: unknown) {
		this.autoResponse = pair;
	}
	acceptWebSocket(ws: FakeSocket, tags: string[]) {
		this.accepted.push({ ws, tags });
	}
	getWebSockets(tag?: string) {
		return this.accepted.filter((a) => !tag || a.tags.includes(tag)).map((a) => a.ws);
	}
}

const NodeResponse = Response;

/** Node's Response rejects the status 101 (with `webSocket`) that workerd uses for upgrades. */
function WorkerdResponse(body: BodyInit | null, init: ResponseInit & { webSocket?: unknown } = {}) {
	return init.status === 101
		? { status: 101, webSocket: init.webSocket }
		: new NodeResponse(body, init);
}

let state: FakeState;
let room: ChatRoom;

beforeEach(() => {
	vi.stubGlobal('Response', WorkerdResponse);
	vi.stubGlobal(
		'WebSocketPair',
		class {
			0 = new FakeSocket();
			1 = new FakeSocket();
		}
	);
	vi.stubGlobal(
		'WebSocketRequestResponsePair',
		class {
			constructor(
				readonly request: string,
				readonly response: string
			) {}
		}
	);
	state = new FakeState();
	room = new ChatRoom(state as unknown as DurableObjectState, {} as Env);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

function connect(userId: string | null, upgrade = 'websocket') {
	const headers: Record<string, string> = { Upgrade: upgrade };
	if (userId) headers['x-user-id'] = userId;
	return room.fetch(new Request('https://chat-room/connect', { headers }));
}

/** Connects `userId` and returns the server side of the new socket. */
async function join(userId: string): Promise<FakeSocket> {
	expect((await connect(userId)).status).toBe(101);
	return state.accepted.at(-1)!.ws;
}

const asSocket = (ws: FakeSocket) => ws as unknown as WebSocket;

describe('ChatRoom', () => {
	it('answers heartbeats without waking the object', () => {
		expect(state.autoResponse).toEqual({ request: 'ping', response: 'pong' });
	});

	it('rejects requests that are not a member’s WebSocket upgrade', async () => {
		expect((await connect('alice', 'h2c')).status).toBe(426);
		expect((await connect(null)).status).toBe(426);
		expect(state.accepted).toEqual([]);
	});

	it('accepts a member’s socket, tagged and attached for hibernation', async () => {
		vi.useFakeTimers({ now: 5_000 });
		const res = (await connect('alice')) as Response & { webSocket: unknown };

		expect(res.status).toBe(101);
		expect(state.accepted).toHaveLength(1);
		const [{ ws, tags }] = state.accepted;
		expect(tags).toEqual(['alice']);
		expect(res.webSocket).toBeInstanceOf(FakeSocket);
		expect(res.webSocket).not.toBe(ws);
		expect(ws.deserializeAttachment()).toEqual({
			userId: 'alice',
			lastTypingAt: 0,
			connectedAt: 5_000
		});
	});

	it('closes a member’s oldest socket when they go over the cap, and nobody else’s', async () => {
		vi.useFakeTimers({ now: 1_000 });
		const bob = await join('bob');
		const alice: FakeSocket[] = [];
		for (let i = 0; i < MAX_SOCKETS_PER_USER; i++) {
			vi.advanceTimersByTime(1_000);
			alice.push(await join('alice'));
		}
		expect(alice.every((ws) => ws.closed === null)).toBe(true);

		vi.advanceTimersByTime(1_000);
		await join('alice');

		expect(alice[0].closed).toEqual({ code: TOO_MANY_SOCKETS_CODE, reason: expect.any(String) });
		expect(alice.slice(1).every((ws) => ws.closed === null)).toBe(true);
		expect(bob.closed).toBeNull();
	});

	it('broadcasts a stored message to every member’s sockets', async () => {
		const sockets = [await join('alice'), await join('alice'), await join('bob')];
		const event = {
			type: 'message',
			message: { id: 'm1', conversationId: 'c1', senderId: 'alice', content: 'hi', createdAt: 1 }
		} as const;

		room.broadcast(event);

		for (const ws of sockets) expect(ws.sent.map((s) => JSON.parse(s))).toEqual([event]);
	});

	it('relays typing to the other member only', async () => {
		const [aliceTab1, aliceTab2, bob] = [
			await join('alice'),
			await join('alice'),
			await join('bob')
		];

		room.webSocketMessage(asSocket(aliceTab1), '{"type":"typing"}');
		room.webSocketMessage(asSocket(aliceTab1), '{"type":"message","content":"spoof"}');

		expect(bob.sent).toEqual(['{"type":"typing","userId":"alice"}']);
		expect(aliceTab1.sent).toEqual([]);
		expect(aliceTab2.sent).toEqual([]);
	});

	it('closeAll(code, reason) disconnects everyone, skipping sockets already closed', async () => {
		const [alice, gone, bob] = [await join('alice'), await join('alice'), await join('bob')];
		gone.close(1000, 'left');

		room.closeAll(CONVERSATION_CLOSED_CODE, 'Conversation closed');

		for (const ws of [alice, bob]) {
			expect(ws.closed).toEqual({ code: CONVERSATION_CLOSED_CODE, reason: 'Conversation closed' });
		}
		expect(gone.closed).toEqual({ code: 1000, reason: 'left' });
	});

	it('completes the close handshake, mapping "no status" to a normal close', async () => {
		const [a, b, c] = [await join('alice'), await join('bob'), await join('bob')];

		room.webSocketClose(asSocket(a), 1005, '');
		room.webSocketClose(asSocket(b), 4001, 'bye');
		c.close(1000, 'done');
		expect(() => room.webSocketClose(asSocket(c), 1000, 'done')).not.toThrow();

		expect(a.closed).toEqual({ code: 1000, reason: '' });
		expect(b.closed).toEqual({ code: 4001, reason: 'bye' });
	});
});
