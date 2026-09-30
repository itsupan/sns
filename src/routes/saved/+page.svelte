<script lang="ts">
	import PostCard, { type PostData } from '$lib/components/feed/PostCard.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { readApiError } from '$lib/utils/api-error';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Pages loaded while scrolling, appended after the server-rendered first page. */
	let more = $state<PostData[]>([]);
	let moreCursor = $state<string | null | undefined>(undefined);
	let loadingMore = $state(false);
	let loadError = $state<string | null>(null);
	let sentinelEl = $state<HTMLDivElement | null>(null);

	let posts = $derived.by(() => {
		const seen = new Set(data.posts.map((p) => p.id));
		return [...data.posts, ...more.filter((p) => !seen.has(p.id))];
	});
	let nextCursor = $derived(moreCursor === undefined ? data.nextCursor : moreCursor);

	async function loadMore() {
		if (!nextCursor || loadingMore) return;
		loadingMore = true;
		loadError = null;
		try {
			const res = await fetch(`/api/saved?cursor=${encodeURIComponent(nextCursor)}`);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				loadError = readApiError(body, 'Could not load saved posts').message;
				return;
			}
			const page = body as { posts: PostData[]; nextCursor: string | null };
			more = [...more, ...page.posts];
			moreCursor = page.nextCursor;
		} catch {
			loadError = 'Could not load saved posts';
		} finally {
			loadingMore = false;
		}
	}

	$effect(() => {
		if (!sentinelEl || !nextCursor || loadError) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) loadMore();
			},
			{ rootMargin: '350px 0px' }
		);
		observer.observe(sentinelEl);
		return () => observer.disconnect();
	});
</script>

<svelte:head>
	<title>Saved · Kizuna</title>
</svelte:head>

<main class="w-full max-w-2xl mx-auto px-0 sm:px-6 py-6 flex flex-col gap-4">
	<div class="px-4 sm:px-0">
		<h1 class="text-xl font-bold tracking-tight text-slate-950 dark:text-white m-0">Saved</h1>
		<p class="text-xs text-slate-500 dark:text-dark-muted m-0 mt-1">
			Only you can see what you've saved.
		</p>
	</div>

	{#if posts.length === 0}
		<div
			class="mx-4 sm:mx-0 rounded-3xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card py-16 px-6 flex flex-col items-center gap-2 text-center"
		>
			<Icon name="bookmark" class="text-3xl text-slate-300" />
			<p class="text-sm font-semibold text-slate-900 dark:text-dark-text m-0">No saved posts yet</p>
			<p class="text-xs text-slate-500 dark:text-dark-muted m-0">
				Tap the bookmark on any post to keep it here.
			</p>
		</div>
	{:else}
		<div class="flex flex-col">
			{#each posts as post (post.id)}
				<PostCard {post} />
			{/each}
		</div>

		{#if loadError}
			<div class="py-6 flex flex-col items-center gap-2 text-center" role="alert">
				<p class="text-sm text-slate-600 dark:text-slate-300 m-0">{loadError}</p>
				<button
					type="button"
					class="text-xs font-medium underline text-slate-800 dark:text-slate-200 bg-transparent border-0 cursor-pointer"
					onclick={loadMore}>Try again</button
				>
			</div>
		{:else if nextCursor}
			<div bind:this={sentinelEl} class="h-8 w-full" aria-hidden="true"></div>
			{#if loadingMore}
				<p class="text-center text-xs text-slate-500 dark:text-dark-muted" aria-live="polite">
					Loading…
				</p>
			{/if}
		{/if}
	{/if}
</main>
