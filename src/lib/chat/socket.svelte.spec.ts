import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatSocket, backoffDelay, type SocketLike } from './socket.svelte';

class FakeSocket implements SocketLike {
	readyState = 0;
	sent: string[] = [];
	closed = false;
	onopen: ((ev: Event) => void) | null = null;
	onmessage: ((ev: MessageEvent) => void) | null = null;
	onclose: ((ev: CloseEvent) => void) | null = null;
	onerror: ((ev: Event) => void) | null = null;
	constructor(readonly url: string) {}
	send(data: string) {
		this.sent.push(data);
	}
	close() {
		this.closed = true;
		this.readyState = 3;
	}
	open() {
		this.readyState = 1;
		this.onopen?.(new Event('open'));
	}
	receive(data: string) {
		this.onmessage?.(new MessageEvent('message', { data }));
	}
	drop() {
		this.readyState = 3;
		this.onclose?.(new CloseEvent('close', { code: 1006 }));
	}
}

let sockets: FakeSocket[];
const latest = () => sockets.at(-1)!;

function make(overrides: Partial<ConstructorParameters<typeof ChatSocket>[1]> = {}) {
	const onEvent = vi.fn();
	const onReconnect = vi.fn();
	const chat = new ChatSocket('ws://x/api/chat/ws?conversationId=c1', {
		onEvent,
		onReconnect,
		createSocket: (url) => {
			const s = new FakeSocket(url);
			sockets.push(s);
			return s;
		},
		backoff: { baseMs: 1000, maxMs: 30_000 },
		heartbeatMs: 25_000,
		pongTimeoutMs: 10_000,
		random: () => 0,
		...overrides
	});
	return { chat, onEvent, onReconnect };
}

beforeEach(() => {
	sockets = [];
	vi.useFakeTimers();
});

afterEach(() => vi.useRealTimers());

describe('backoffDelay', () => {
	it('doubles from the base, caps at the max and adds up to 30% jitter', () => {
		const b = { baseMs: 1000, maxMs: 30_000 };
		expect([0, 1, 2, 3, 4, 5, 6].map((n) => backoffDelay(n, b, () => 0))).toEqual([
			1000, 2000, 4000, 8000, 16000, 30000, 30000
		]);
		expect(backoffDelay(0, b, () => 1)).toBe(1300);
		expect(backoffDelay(1000, b, () => 0)).toBe(30000);
	});
});

describe('ChatSocket', () => {
	it('delivers parsed events and ignores malformed frames', () => {
		const { chat, onEvent } = make();
		latest().open();
		expect(chat.status).toBe('open');
		latest().receive('{"type":"typing","userId":"bob"}');
		latest().receive('not json');
		expect(onEvent).toHaveBeenCalledTimes(1);
		expect(onEvent).toHaveBeenCalledWith({ type: 'typing', userId: 'bob' });
		chat.close();
	});

	it('reconnects with growing backoff and reports the reconnect to catch up', () => {
		const { chat, onReconnect } = make();
		latest().open();
		expect(onReconnect).not.toHaveBeenCalled();

		latest().drop();
		expect(chat.status).toBe('reconnecting');
		vi.advanceTimersByTime(999);
		expect(sockets).toHaveLength(1);
		vi.advanceTimersByTime(1);
		expect(sockets).toHaveLength(2);

		// Second failure in a row waits twice as long.
		latest().drop();
		vi.advanceTimersByTime(1999);
		expect(sockets).toHaveLength(2);
		vi.advanceTimersByTime(1);
		expect(sockets).toHaveLength(3);

		latest().open();
		expect(chat.status).toBe('open');
		expect(onReconnect).toHaveBeenCalledTimes(1);

		// A successful open resets the backoff.
		latest().drop();
		vi.advanceTimersByTime(1000);
		expect(sockets).toHaveLength(4);
		chat.close();
	});

	it('does not reconnect when the room evicted it for a newer tab', () => {
		const { chat } = make();
		latest().open();

		latest().readyState = 3;
		latest().onclose?.(new CloseEvent('close', { code: 4008 }));
		vi.advanceTimersByTime(120_000);

		// Still down (so the view polls), and no new socket that would evict another tab.
		expect(chat.status).toBe('reconnecting');
		expect(sockets).toHaveLength(1);
		chat.close();
	});

	it('stops for good when the conversation is closed, e.g. by a block', () => {
		const { chat } = make();
		latest().open();

		latest().readyState = 3;
		latest().onclose?.(new CloseEvent('close', { code: 4003 }));
		vi.advanceTimersByTime(120_000);
		window.dispatchEvent(new Event('online'));

		expect(chat.status).toBe('closed');
		expect(sockets).toHaveLength(1);
	});

	it('recycles a connection that stops answering pings', () => {
		const { chat } = make();
		const first = latest();
		first.open();
		vi.advanceTimersByTime(25_000);
		expect(first.sent).toEqual(['ping']);
		first.receive('pong');

		vi.advanceTimersByTime(25_000);
		expect(first.sent).toEqual(['ping', 'ping']);
		vi.advanceTimersByTime(10_000);
		expect(first.closed).toBe(true);
		expect(chat.status).toBe('reconnecting');
		vi.advanceTimersByTime(1000);
		expect(sockets).toHaveLength(2);
		chat.close();
	});

	it('reconnects immediately when the browser comes back online', () => {
		const { chat } = make();
		latest().open();
		latest().drop();
		expect(sockets).toHaveLength(1);
		window.dispatchEvent(new Event('online'));
		expect(sockets).toHaveLength(2);
		chat.close();
	});

	it('sends typing only while open, and stops for good on close', () => {
		const { chat } = make();
		chat.sendTyping();
		expect(latest().sent).toEqual([]);
		latest().open();
		chat.sendTyping();
		expect(latest().sent).toEqual(['{"type":"typing"}']);

		chat.close();
		expect(latest().closed).toBe(true);
		expect(chat.status).toBe('closed');
		vi.advanceTimersByTime(120_000);
		window.dispatchEvent(new Event('online'));
		expect(sockets).toHaveLength(1);
	});
});
