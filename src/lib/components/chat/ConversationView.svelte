<script lang="ts" module>
	import type { ChatMessage } from '$lib/chat/types';

	/** A message on screen; `pending` ones exist only locally until the server confirms them. */
	export type ViewMessage = ChatMessage & { pending?: 'sending' | 'failed' };

	/** How long a typing signal from the other member stays visible. */
	export const TYPING_VISIBLE_MS = 3500;
	/** While the live connection is down, fetch new messages this often. */
	export const POLL_WHILE_OFFLINE_MS = 5000;
	const TYPING_SEND_INTERVAL_MS = 2000;

	/** Oldest first; ties broken by id, matching the server's order. */
	export function byTime(a: ChatMessage, b: ChatMessage): number {
		return a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	}
</script>

<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { ChatSocket, type SocketLike } from '$lib/chat/socket.svelte';
	import { MAX_MESSAGE_LENGTH, type ChatServerEvent, type ChatUser } from '$lib/chat/types';
	import { readApiError } from '$lib/utils/api-error';
	import { toast } from '$lib/utils/toast.svelte';

	interface Props {
		conversationId: string;
		other: ChatUser;
		viewerId: string;
		initialMessages: ChatMessage[];
		/** Cursor for older history, or null when the first page is all there is. */
		initialCursor: string | null;
		/** Injected in tests. */
		createSocket?: (url: string) => SocketLike;
	}

	let { conversationId, other, viewerId, initialMessages, initialCursor, createSocket }: Props =
		$props();

	/** Confirmed messages by id, plus local pending ones (keyed by temp id). */
	let byId = $state<Record<string, ViewMessage>>(
		untrack(() => Object.fromEntries(initialMessages.map((m) => [m.id, m])))
	);
	let olderCursor = $state<string | null>(untrack(() => initialCursor));
	let loadingOlder = $state(false);
	let draft = $state('');
	let otherTyping = $state(false);
	let scroller = $state<HTMLDivElement | null>(null);
	let socket = $state<ChatSocket | null>(null);

	let messages = $derived(Object.values(byId).sort(byTime));
	let online = $derived(socket?.status === 'open');

	let typingTimer: ReturnType<typeof setTimeout> | null = null;
	let lastTypingSentAt = 0;
	let catchingUp = false;

	const api = (path = '') => `/api/conversations/${encodeURIComponent(conversationId)}${path}`;

	function merge(list: ChatMessage[]) {
		for (const m of list) {
			if (m.conversationId === conversationId) byId[m.id] = m;
		}
	}

	function isNearBottom() {
		if (!scroller) return true;
		return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;
	}

	async function scrollToBottom() {
		await tick();
		scroller?.scrollTo({ top: scroller.scrollHeight });
	}

	let readPending = false;
	async function markRead() {
		if (readPending || document.visibilityState !== 'visible') return;
		readPending = true;
		try {
			await fetch(api('/read'), { method: 'POST' });
		} catch {
			// Best effort; the next visit marks it read.
		} finally {
			readPending = false;
		}
	}

	/** Fetches everything after the newest confirmed message (after a reconnect or while polling). */
	async function catchUp() {
		if (catchingUp) return;
		catchingUp = true;
		try {
			const stick = isNearBottom();
			const countBefore = Object.keys(byId).length;
			let after = messages.filter((m) => !m.pending).at(-1)?.id;
			// With no messages yet, the latest page is the catch-up; otherwise page forward.
			for (let more = true; more;) {
				const res = await fetch(
					after ? api(`/messages?after=${encodeURIComponent(after)}`) : api('/messages')
				);
				if (!res.ok) return;
				const page = (await res.json()) as { messages: ChatMessage[]; hasMore: boolean };
				merge(page.messages);
				more = Boolean(after) && page.hasMore && page.messages.length > 0;
				after = page.messages.at(-1)?.id ?? after;
			}
			if (Object.keys(byId).length > countBefore) {
				if (stick) scrollToBottom();
				markRead();
			}
		} catch {
			// Offline; the next reconnect or poll retries.
		} finally {
			catchingUp = false;
		}
	}

	function onEvent(event: ChatServerEvent) {
		if (event.type === 'message') {
			const stick = isNearBottom() || event.message.senderId === viewerId;
			merge([event.message]);
			if (event.message.senderId !== viewerId) {
				otherTyping = false;
				markRead();
			}
			if (stick) scrollToBottom();
		} else if (event.type === 'typing' && event.userId !== viewerId) {
			otherTyping = true;
			if (typingTimer) clearTimeout(typingTimer);
			typingTimer = setTimeout(() => (otherTyping = false), TYPING_VISIBLE_MS);
		}
	}

	// Live connection for the lifetime of the view.
	$effect(() => {
		const url = `${location.origin.replace(/^http/, 'ws')}/api/chat/ws?conversationId=${encodeURIComponent(conversationId)}`;
		const s = new ChatSocket(url, {
			onEvent,
			onReconnect: catchUp,
			...(createSocket ? { createSocket } : {})
		});
		socket = s;
		return () => {
			s.close();
			if (typingTimer) clearTimeout(typingTimer);
		};
	});

	// Messages that arrived while the tab was hidden become read when the user returns.
	$effect(() => {
		const onVisible = () => document.visibilityState === 'visible' && markRead();
		document.addEventListener('visibilitychange', onVisible);
		return () => document.removeEventListener('visibilitychange', onVisible);
	});

	// Fallback while the socket is down (bad network, or `vite dev` without Durable Objects).
	$effect(() => {
		if (online) return;
		const timer = setInterval(() => {
			if (document.visibilityState === 'visible') catchUp();
		}, POLL_WHILE_OFFLINE_MS);
		return () => clearInterval(timer);
	});

	$effect(() => {
		untrack(() => scrollToBottom());
	});

	async function loadOlder() {
		if (!olderCursor || loadingOlder) return;
		loadingOlder = true;
		const previousHeight = scroller?.scrollHeight ?? 0;
		try {
			const res = await fetch(api(`/messages?cursor=${encodeURIComponent(olderCursor)}`));
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(readApiError(body, 'Could not load earlier messages').message);
			const page = body as { messages: ChatMessage[]; nextCursor: string | null };
			merge(page.messages);
			olderCursor = page.nextCursor;
			// Keep the view anchored on what the user was reading.
			await tick();
			if (scroller) scroller.scrollTop += scroller.scrollHeight - previousHeight;
		} catch (err) {
			toast.show(err instanceof Error ? err.message : 'Could not load earlier messages');
		} finally {
			loadingOlder = false;
		}
	}

	/**
	 * Posts a pending message. The id is generated here and sent along, so the server stores a
	 * retried send once, and its copy (or the WebSocket echo) replaces the pending entry in place.
	 */
	async function deliver(id: string, content: string) {
		if (!byId[id]?.pending) return;
		byId[id] = { ...byId[id], pending: 'sending' };
		try {
			const res = await fetch(api('/messages'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, content })
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(readApiError(body, 'Message not sent').message);
			merge([(body as { message: ChatMessage }).message]);
		} catch (err) {
			// The response can be lost after the server stored it; if the echo already
			// confirmed the message, it was sent.
			if (!byId[id]?.pending) return;
			byId[id] = { ...byId[id], pending: 'failed' };
			toast.show(err instanceof Error ? err.message : 'Message not sent');
		}
	}

	function send(e?: Event) {
		e?.preventDefault();
		const content = draft.trim();
		if (!content) return;
		if (content.length > MAX_MESSAGE_LENGTH) {
			toast.show(`Messages can be up to ${MAX_MESSAGE_LENGTH} characters`);
			return;
		}
		const id = crypto.randomUUID();
		const newest = messages.at(-1);
		byId[id] = {
			id,
			conversationId,
			senderId: viewerId,
			content,
			// Sorts after everything on screen until the server assigns the real time.
			createdAt: Math.max(Date.now(), (newest?.createdAt ?? 0) + 1),
			pending: 'sending'
		};
		draft = '';
		scrollToBottom();
		deliver(id, content);
	}

	function retry(m: ViewMessage) {
		deliver(m.id, m.content);
	}

	function discard(m: ViewMessage) {
		delete byId[m.id];
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) send(e);
	}

	function onInput() {
		const now = Date.now();
		if (draft.trim() && now - lastTypingSentAt >= TYPING_SEND_INTERVAL_MS) {
			lastTypingSentAt = now;
			socket?.sendTyping();
		}
	}

	const timeLabel = (ms: number) =>
		new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
	const dayLabel = (ms: number) =>
		new Date(ms).toLocaleDateString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	const sameDay = (a: number, b: number) =>
		new Date(a).toDateString() === new Date(b).toDateString();
</script>

<section
	class="w-full max-w-2xl mx-auto flex flex-col chat-height bg-white dark:bg-dark-card sm:border-x border-slate-200 dark:border-dark-border"
	aria-label="Conversation with {other.name}"
>
	<header
		class="flex items-center gap-3 px-3 sm:px-4 h-14 border-b border-slate-100 dark:border-dark-border shrink-0"
	>
		<a
			href={resolve('/messages')}
			class="size-9 rounded-full flex items-center justify-center text-slate-600 dark:text-dark-muted hover:bg-slate-100 dark:hover:bg-dark-elevated"
			aria-label="Back to messages"
		>
			<Icon name="angle-left" class="text-lg" />
		</a>
		<a
			href={resolve('/profile/[id]', { id: other.slug })}
			class="flex items-center gap-2.5 min-w-0 no-underline"
		>
			<Avatar src={other.image ?? ''} name={other.name} size="sm" />
			<div class="min-w-0">
				<p class="text-sm font-semibold text-slate-900 dark:text-dark-text truncate m-0">
					{other.name}
				</p>
				<p class="text-[11px] text-slate-500 dark:text-dark-muted truncate m-0" aria-live="polite">
					{otherTyping ? 'typing…' : other.handle}
				</p>
			</div>
		</a>
		{#if socket && !online}
			<span
				class="ml-auto text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1"
				role="status"
			>
				<span class="size-1.5 rounded-full bg-amber-500"></span>
				{socket.status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
			</span>
		{/if}
	</header>

	<div
		bind:this={scroller}
		class="flex-1 overflow-y-auto px-3 sm:px-4 py-4 flex flex-col gap-1"
		role="log"
		aria-label="Messages"
		aria-live="polite"
	>
		{#if olderCursor}
			<button
				type="button"
				onclick={loadOlder}
				disabled={loadingOlder}
				class="self-center mb-2 h-8 px-4 rounded-full border border-slate-200 dark:border-dark-border bg-transparent text-xs font-semibold text-slate-600 dark:text-dark-muted cursor-pointer disabled:opacity-50"
			>
				{loadingOlder ? 'Loading…' : 'Load earlier messages'}
			</button>
		{/if}

		{#if messages.length === 0}
			<div class="m-auto flex flex-col items-center gap-2 text-center py-10">
				<Avatar src={other.image ?? ''} name={other.name} size="xl" />
				<p class="text-sm font-semibold text-slate-900 dark:text-dark-text m-0">{other.name}</p>
				<p class="text-xs text-slate-500 dark:text-dark-muted m-0">Say hello 👋</p>
			</div>
		{/if}

		{#each messages as m, i (m.id)}
			{@const mine = m.senderId === viewerId}
			{@const prev = messages[i - 1]}
			{#if !prev || !sameDay(prev.createdAt, m.createdAt)}
				<p class="self-center text-[11px] text-slate-400 my-2 m-0">{dayLabel(m.createdAt)}</p>
			{/if}
			<div
				class="flex flex-col max-w-[80%] {mine ? 'self-end items-end' : 'self-start items-start'}"
				data-testid="message"
			>
				<p
					class="m-0 px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words {mine
						? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 rounded-br-md'
						: 'bg-slate-100 text-slate-900 dark:bg-dark-elevated dark:text-dark-text rounded-bl-md'} {m.pending ===
					'sending'
						? 'opacity-60'
						: ''}"
				>
					{m.content}
				</p>
				{#if m.pending === 'failed'}
					<p class="m-0 mt-1 text-[11px] text-rose-600 flex items-center gap-2">
						Not sent
						<button
							type="button"
							onclick={() => retry(m)}
							class="font-semibold underline bg-transparent border-0 p-0 text-inherit cursor-pointer"
						>
							Retry
						</button>
						<button
							type="button"
							onclick={() => discard(m)}
							class="font-semibold underline bg-transparent border-0 p-0 text-inherit cursor-pointer"
						>
							Delete
						</button>
					</p>
				{:else}
					<time
						class="text-[10px] text-slate-400 mt-0.5 px-1"
						datetime={new Date(m.createdAt).toISOString()}
					>
						{m.pending === 'sending' ? 'Sending…' : timeLabel(m.createdAt)}
					</time>
				{/if}
			</div>
		{/each}
	</div>

	<form
		onsubmit={send}
		class="flex items-end gap-2 p-3 border-t border-slate-100 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated shrink-0"
	>
		<textarea
			bind:value={draft}
			oninput={onInput}
			onkeydown={onKeydown}
			rows="1"
			maxlength={MAX_MESSAGE_LENGTH}
			placeholder="Message {other.name}…"
			aria-label="Message {other.name}"
			class="flex-1 resize-none max-h-32 field-sizing-content min-h-10 px-4 py-2.5 text-sm bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-2xl text-slate-900 dark:text-dark-text placeholder:text-slate-400 focus:outline-none focus:ring-1.5 focus:ring-slate-900 dark:focus:ring-white"
		></textarea>
		<button
			type="submit"
			disabled={!draft.trim()}
			aria-label="Send"
			class="size-10 shrink-0 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition"
		>
			<Icon name="paper-plane" class="text-sm" />
		</button>
	</form>
</section>
