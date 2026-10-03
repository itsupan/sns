<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import LoadMore from '$lib/components/shared/LoadMore.svelte';
	import { formatTimeAgo } from '$lib/utils/format';
	import { readApiError } from '$lib/utils/api-error';
	import type { InboxItem } from '$lib/chat/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Pages loaded while scrolling, appended after the server-rendered first page. */
	let more = $state<InboxItem[]>([]);
	let moreCursor = $state<string | null | undefined>(undefined);
	let loadingMore = $state(false);
	let loadError = $state<string | null>(null);

	let conversations = $derived.by(() => {
		const seen = new Set(data.conversations.map((c) => c.id));
		return [...data.conversations, ...more.filter((c) => !seen.has(c.id))];
	});
	let nextCursor = $derived(moreCursor === undefined ? data.nextCursor : moreCursor);

	async function loadMore() {
		if (!nextCursor || loadingMore) return;
		loadingMore = true;
		loadError = null;
		try {
			const res = await fetch(`/api/conversations?cursor=${encodeURIComponent(nextCursor)}`);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				loadError = readApiError(body, 'Could not load conversations').message;
				return;
			}
			const page = body as { conversations: InboxItem[]; nextCursor: string | null };
			more = [...more, ...page.conversations];
			moreCursor = page.nextCursor;
		} catch {
			loadError = 'Could not load conversations';
		} finally {
			loadingMore = false;
		}
	}

	// Refresh order and unread counts when the tab comes back.
	$effect(() => {
		const onVisible = () => {
			if (document.visibilityState === 'visible') {
				more = [];
				moreCursor = undefined;
				loadError = null;
				invalidateAll();
			}
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => document.removeEventListener('visibilitychange', onVisible);
	});

	function preview(c: InboxItem): string {
		if (!c.lastMessage) return '';
		const prefix = c.lastMessage.senderId === data.viewerId ? 'You: ' : '';
		return `${prefix}${c.lastMessage.content}`;
	}
</script>

<svelte:head>
	<title>Messages · Kizuna</title>
</svelte:head>

<main class="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
	<h1 class="text-xl font-bold tracking-tight text-slate-950 dark:text-white m-0">Messages</h1>

	{#if conversations.length === 0}
		<div
			class="rounded-3xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card py-16 px-6 flex flex-col items-center gap-2 text-center"
		>
			<Icon name="comment-alt" class="text-3xl text-slate-300" />
			<p class="text-sm font-semibold text-slate-900 dark:text-dark-text m-0">No messages yet</p>
			<p class="text-xs text-slate-500 dark:text-dark-muted m-0">
				Open someone’s profile and tap Message to start a conversation.
			</p>
		</div>
	{:else}
		<ul
			class="list-none m-0 p-0 rounded-3xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card divide-y divide-slate-100 dark:divide-dark-border overflow-hidden"
		>
			{#each conversations as c (c.id)}
				<li>
					<a
						href={resolve('/messages/[id]', { id: c.id })}
						class="flex items-center gap-3 px-4 py-3 no-underline hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors"
					>
						<Avatar src={c.other.image ?? ''} name={c.other.name} size="md" />
						<div class="min-w-0 flex-1">
							<div class="flex items-baseline gap-2">
								<span
									class="text-sm truncate text-slate-900 dark:text-dark-text {c.unreadCount
										? 'font-bold'
										: 'font-semibold'}">{c.other.name}</span
								>
								{#if c.lastMessage}
									<span class="text-[11px] text-slate-400 shrink-0 ml-auto">
										{formatTimeAgo(c.lastMessage.createdAt)}
									</span>
								{/if}
							</div>
							<p
								class="text-xs truncate m-0 mt-0.5 {c.unreadCount
									? 'text-slate-900 dark:text-white font-semibold'
									: 'text-slate-500 dark:text-dark-muted'}"
							>
								{preview(c)}
							</p>
						</div>
						{#if c.unreadCount > 0}
							<span
								class="min-w-5 h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0"
								aria-label="{c.unreadCount} unread"
							>
								{c.unreadCount > 99 ? '99+' : c.unreadCount}
							</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>

		{#if nextCursor}
			<LoadMore onLoad={loadMore} loading={loadingMore} error={loadError} />
		{/if}
	{/if}
</main>
