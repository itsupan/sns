<script lang="ts">
	import PostCard, { type PostData } from '$lib/components/feed/PostCard.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import LoadMore from '$lib/components/shared/LoadMore.svelte';
	import { readApiError } from '$lib/utils/api-error';
	import { m } from '$lib/i18n';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Pages loaded while scrolling, appended after the server-rendered first page. */
	let more = $state<PostData[]>([]);
	let moreCursor = $state<string | null | undefined>(undefined);
	let loadingMore = $state(false);
	let loadError = $state<string | null>(null);

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
				loadError = readApiError(body, m.profile_saved_load_error()).message;
				return;
			}
			const page = body as { posts: PostData[]; nextCursor: string | null };
			more = [...more, ...page.posts];
			moreCursor = page.nextCursor;
		} catch {
			loadError = m.profile_saved_load_error();
		} finally {
			loadingMore = false;
		}
	}
</script>

<svelte:head>
	<title>{m.profile_saved_title()}</title>
</svelte:head>

<main class="w-full max-w-2xl mx-auto px-0 sm:px-6 py-6 flex flex-col gap-4">
	<div class="px-4 sm:px-0">
		<h1 class="text-xl font-bold tracking-tight text-slate-950 dark:text-white m-0">
			{m.nav_saved()}
		</h1>
		<p class="text-xs text-slate-500 dark:text-dark-muted m-0 mt-1">
			{m.profile_saved_hint()}
		</p>
	</div>

	{#if posts.length === 0}
		<div
			class="mx-4 sm:mx-0 rounded-3xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card py-16 px-6 flex flex-col items-center gap-2 text-center"
		>
			<Icon name="bookmark" class="text-3xl text-slate-300" />
			<p class="text-sm font-semibold text-slate-900 dark:text-dark-text m-0">
				{m.profile_saved_empty()}
			</p>
			<p class="text-xs text-slate-500 dark:text-dark-muted m-0">
				{m.profile_saved_empty_hint()}
			</p>
		</div>
	{:else}
		<div class="flex flex-col">
			{#each posts as post (post.id)}
				<PostCard {post} />
			{/each}
		</div>

		{#if nextCursor}
			<LoadMore onLoad={loadMore} loading={loadingMore} error={loadError} />
		{/if}
	{/if}
</main>
