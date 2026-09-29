import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConversationView from './ConversationView.svelte';
import type { SocketLike } from '$lib/chat/socket.svelte';
import type { ChatMessage } from '$lib/chat/types';

class FakeSocket implements SocketLike {
	readyState = 0;
	sent: string[] = [];
	onopen: ((ev: Event) => void) | null = null;
	onmessage: ((ev: MessageEvent) => void) | null = null;
	onclose: ((ev: CloseEvent) => void) | null = null;
	onerror: ((ev: Event) => void) | null = null;
	send(data: string) {
		this.sent.push(data);
	}
	close() {
		this.readyState = 3;
	}
	open() {
		this.readyState = 1;
		this.onopen?.(new Event('open'));
	}
	push(event: unknown) {
		this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(event) }));
	}
	drop() {
		this.readyState = 3;
		this.onclose?.(new CloseEvent('close'));
	}
}

const other = { id: 'bob', name: 'Bob', handle: '@bob', slug: 'bob', image: null };
let sockets: FakeSocket[];
let posted: Array<{ url: string; body: unknown }>;
let respond: (url: string, method: string) => { status?: number; body: unknown };

const msg = (id: string, senderId: string, content: string, createdAt: number): ChatMessage => ({
	id,
	conversationId: 'c1',
	senderId,
	content,
	createdAt
});

beforeEach(() => {
	sockets = [];
	posted = [];
	respond = () => ({ body: { ok: true } });
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			const method = init?.method ?? 'GET';
			if (method === 'POST')
				posted.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
			const { status = 200, body } = respond(url, method);
			return new Response(JSON.stringify(body), { status });
		})
	);
});

afterEach(() => vi.unstubAllGlobals());

function renderView(initialMessages: ChatMessage[] = [], initialCursor: string | null = null) {
	return render(ConversationView, {
		props: {
			conversationId: 'c1',
			other,
			viewerId: 'alice',
			initialMessages,
			initialCursor,
			createSocket: () => {
				const s = new FakeSocket();
				sockets.push(s);
				return s;
			}
		}
	});
}

describe('ConversationView', () => {
	it('renders history oldest first and appends live messages once', async () => {
		const screen = renderView([
			msg('m2', 'bob', 'second', 2000),
			msg('m1', 'alice', 'first', 1000)
		]);
		sockets[0].open();
		const bubbles = () =>
			screen
				.getByTestId('message')
				.elements()
				.map((e) => e.textContent ?? '');
		await expect.element(screen.getByText('second')).toBeVisible();
		expect(bubbles()[0]).toContain('first');

		const live = msg('m3', 'bob', 'third', 3000);
		sockets[0].push({ type: 'message', message: live });
		sockets[0].push({ type: 'message', message: live });
		await expect.element(screen.getByText('third')).toBeVisible();
		expect(bubbles()).toHaveLength(3);
		// A message from the other member marks the conversation read.
		expect(posted.some((p) => p.url.endsWith('/c1/read'))).toBe(true);
	});

	it('sends with Enter, shows the message at once and reconciles with the server copy', async () => {
		let release!: () => void;
		const gate = new Promise<void>((r) => (release = r));
		respond = (url, method) =>
			method === 'POST' && url.endsWith('/messages')
				? { status: 201, body: { message: msg('srv-1', 'alice', 'hello bob', 5000) } }
				: { body: { ok: true } };
		const fetchMock = globalThis.fetch;
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				if (init?.method === 'POST' && String(input).endsWith('/messages')) await gate;
				return fetchMock(input, init);
			})
		);
		const screen = renderView();
		sockets[0].open();

		const box = screen.getByRole('textbox', { name: 'Message Bob' });
		await box.click();
		await userEvent.keyboard('hello bob{Enter}');
		await expect.element(screen.getByText('Sending…')).toBeVisible();
		await expect.element(box).toHaveValue('');

		// The WebSocket echo can arrive before the POST response: still one bubble.
		sockets[0].push({ type: 'message', message: msg('srv-1', 'alice', 'hello bob', 5000) });
		release();
		await expect.element(screen.getByText('Sending…')).not.toBeInTheDocument();
		expect(screen.getByText('hello bob').elements()).toHaveLength(1);
		expect(posted.find((p) => p.url.endsWith('/c1/messages'))?.body).toEqual({
			content: 'hello bob'
		});
	});

	it('keeps a failed message with Retry', async () => {
		let fail = true;
		respond = (url, method) =>
			method === 'POST' && url.endsWith('/messages')
				? fail
					? { status: 429, body: { error: { code: 'rate_limited', message: 'Slow down' } } }
					: { status: 201, body: { message: msg('srv-2', 'alice', 'retry me', 6000) } }
				: { body: { ok: true } };
		const screen = renderView();
		await screen.getByRole('textbox').fill('retry me');
		await screen.getByRole('button', { name: 'Send' }).click();
		await expect.element(screen.getByText('Not sent')).toBeVisible();

		fail = false;
		await screen.getByRole('button', { name: 'Retry' }).click();
		await expect.element(screen.getByText('Not sent')).not.toBeInTheDocument();
		expect(screen.getByText('retry me').elements()).toHaveLength(1);
	});

	it('shows the typing indicator from the other member only', async () => {
		const screen = renderView();
		sockets[0].open();
		sockets[0].push({ type: 'typing', userId: 'alice' });
		await expect.element(screen.getByText('@bob')).toBeVisible();
		sockets[0].push({ type: 'typing', userId: 'bob' });
		await expect.element(screen.getByText('typing…')).toBeVisible();
	});

	it('signals typing while composing, throttled', async () => {
		const screen = renderView();
		sockets[0].open();
		await screen.getByRole('textbox').click();
		await userEvent.keyboard('abc');
		expect(sockets[0].sent).toEqual(['{"type":"typing"}']);
	});

	it('catches up over HTTP after a reconnect', async () => {
		respond = (url) =>
			url.includes('after=m1')
				? {
						body: {
							messages: [
								msg('m1', 'bob', 'one', 1000),
								msg('m2', 'bob', 'missed while offline', 2000)
							],
							hasMore: false,
							nextCursor: null
						}
					}
				: { body: { ok: true } };
		const screen = renderView([msg('m1', 'bob', 'one', 1000)]);
		sockets[0].open();
		sockets[0].drop();
		await expect.element(screen.getByText('Reconnecting…')).toBeVisible();

		await vi.waitFor(() => expect(sockets).toHaveLength(2), { timeout: 3000 });
		sockets[1].open();
		await expect.element(screen.getByText('missed while offline')).toBeVisible();
		expect(screen.getByText('one').elements()).toHaveLength(1);
	});

	it('loads earlier messages with the cursor', async () => {
		respond = (url) =>
			url.includes('cursor=older')
				? { body: { messages: [msg('m0', 'bob', 'ancient', 500)], nextCursor: null } }
				: { body: { ok: true } };
		const screen = renderView([msg('m1', 'bob', 'recent', 1000)], 'older');
		await screen.getByRole('button', { name: 'Load earlier messages' }).click();
		await expect.element(screen.getByText('ancient')).toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: 'Load earlier messages' }))
			.not.toBeInTheDocument();
	});
});
