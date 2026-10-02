import { CONVERSATION_CLOSED_CODE, TOO_MANY_SOCKETS_CODE, type ChatServerEvent } from './types';

export type SocketStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

/** The subset of the browser WebSocket this client uses (injectable for tests). */
export interface SocketLike {
	readyState: number;
	onopen: ((ev: Event) => void) | null;
	onmessage: ((ev: MessageEvent) => void) | null;
	onclose: ((ev: CloseEvent) => void) | null;
	onerror: ((ev: Event) => void) | null;
	send(data: string): void;
	close(code?: number, reason?: string): void;
}

export interface ChatSocketOptions {
	/** Server events: new messages and typing signals. */
	onEvent: (event: ChatServerEvent) => void;
	/** Called after every reconnect (not the first open), to fetch messages missed while down. */
	onReconnect?: () => void;
	createSocket?: (url: string) => SocketLike;
	/** Backoff: `base * 2^attempt` capped at `max`, plus up to 30% jitter. */
	backoff?: { baseMs: number; maxMs: number };
	/** Heartbeat interval; the connection is recycled if a pong does not arrive in time. */
	heartbeatMs?: number;
	pongTimeoutMs?: number;
	random?: () => number;
}

const OPEN = 1;

/** Delay before reconnect attempt `attempt` (0-based). */
export function backoffDelay(
	attempt: number,
	{ baseMs, maxMs }: { baseMs: number; maxMs: number },
	random = Math.random
): number {
	const capped = Math.min(maxMs, baseMs * 2 ** Math.min(attempt, 16));
	return Math.round(capped * (1 + 0.3 * random()));
}

/**
 * A conversation's live connection. Reconnects with exponential backoff and jitter, recycles a
 * silently dead connection via ping/pong, reconnects immediately when the browser comes back
 * online or the tab becomes visible, and reports reconnects so the caller can catch up over
 * HTTP. Messages are never sent over the socket; only typing signals are.
 */
export class ChatSocket {
	status = $state<SocketStatus>('connecting');

	private socket: SocketLike | null = null;
	private attempt = 0;
	private everOpened = false;
	private stopped = false;
	private retryTimer: ReturnType<typeof setTimeout> | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private pongTimer: ReturnType<typeof setTimeout> | null = null;
	private readonly opts: Required<Omit<ChatSocketOptions, 'onReconnect'>> &
		Pick<ChatSocketOptions, 'onReconnect'>;

	constructor(
		private readonly url: string,
		options: ChatSocketOptions
	) {
		this.opts = {
			createSocket: (u) => new WebSocket(u),
			backoff: { baseMs: 1000, maxMs: 30_000 },
			heartbeatMs: 25_000,
			pongTimeoutMs: 10_000,
			random: Math.random,
			...options
		};
		if (typeof window !== 'undefined') {
			window.addEventListener('online', this.reconnectNow);
			document.addEventListener('visibilitychange', this.onVisibility);
		}
		this.connect();
	}

	/** Tells the other member we are typing (the server throttles relays). */
	sendTyping() {
		if (this.socket?.readyState === OPEN) this.socket.send(JSON.stringify({ type: 'typing' }));
	}

	/** Closes for good (component unmount). */
	close() {
		this.stopped = true;
		this.status = 'closed';
		this.clearTimers();
		if (typeof window !== 'undefined') {
			window.removeEventListener('online', this.reconnectNow);
			document.removeEventListener('visibilitychange', this.onVisibility);
		}
		const socket = this.socket;
		this.socket = null;
		socket?.close(1000, 'done');
	}

	private connect() {
		if (this.stopped) return;
		this.status = this.everOpened ? 'reconnecting' : 'connecting';
		let socket: SocketLike;
		try {
			socket = this.opts.createSocket(this.url);
		} catch {
			this.scheduleReconnect();
			return;
		}
		this.socket = socket;

		socket.onopen = () => {
			if (this.socket !== socket) return;
			const reconnected = this.everOpened;
			this.everOpened = true;
			this.attempt = 0;
			this.status = 'open';
			this.startHeartbeat();
			if (reconnected) this.opts.onReconnect?.();
		};
		socket.onmessage = (ev) => {
			if (this.socket !== socket) return;
			if (ev.data === 'pong') {
				if (this.pongTimer) clearTimeout(this.pongTimer);
				this.pongTimer = null;
				return;
			}
			try {
				this.opts.onEvent(JSON.parse(String(ev.data)) as ChatServerEvent);
			} catch {
				// Ignore malformed frames.
			}
		};
		socket.onclose = (ev) => {
			if (this.socket !== socket) return;
			this.socket = null;
			// The conversation was closed (a block): there is nothing to reconnect to.
			if (ev?.code === CONVERSATION_CLOSED_CODE) {
				this.close();
				return;
			}
			// Evicted for a newer tab: reconnecting would evict that one in turn. The view keeps
			// polling, and coming back online or to the tab connects again.
			if (ev?.code === TOO_MANY_SOCKETS_CODE) {
				this.clearTimers();
				this.status = 'reconnecting';
				return;
			}
			this.scheduleReconnect();
		};
		socket.onerror = () => {
			// onclose follows and schedules the retry.
		};
	}

	private scheduleReconnect() {
		this.clearTimers();
		if (this.stopped) return;
		this.status = 'reconnecting';
		const delay = backoffDelay(this.attempt++, this.opts.backoff, this.opts.random);
		this.retryTimer = setTimeout(() => this.connect(), delay);
	}

	/** Drop any pending wait and reconnect now (network back, tab visible again). */
	private reconnectNow = () => {
		if (this.stopped || this.status === 'open' || this.status === 'connecting') return;
		this.attempt = 0;
		if (this.retryTimer) clearTimeout(this.retryTimer);
		this.retryTimer = null;
		this.connect();
	};

	private onVisibility = () => {
		if (document.visibilityState === 'visible') this.reconnectNow();
	};

	private startHeartbeat() {
		if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
		this.heartbeatTimer = setInterval(() => {
			const socket = this.socket;
			if (!socket || socket.readyState !== OPEN) return;
			socket.send('ping');
			if (this.pongTimer) return;
			this.pongTimer = setTimeout(() => {
				// No pong: the connection is dead even if the browser has not noticed.
				this.pongTimer = null;
				if (this.socket !== socket) return;
				this.socket = null;
				socket.close(4000, 'heartbeat timeout');
				this.scheduleReconnect();
			}, this.opts.pongTimeoutMs);
		}, this.opts.heartbeatMs);
	}

	private clearTimers() {
		if (this.retryTimer) clearTimeout(this.retryTimer);
		if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
		if (this.pongTimer) clearTimeout(this.pongTimer);
		this.retryTimer = this.heartbeatTimer = this.pongTimer = null;
	}
}
