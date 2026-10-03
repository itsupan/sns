<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/shared/Icon.svelte';
	import TileGrid from '$lib/components/explore/TileGrid.svelte';
	import LoadMore from '$lib/components/shared/LoadMore.svelte';
	import { readApiError } from '$lib/utils/api-error';
	import type { ExploreTile } from '$lib/explore/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Reset when navigating from one tag to another.
	let more = $state<ExploreTile[]>([]);
	let moreCursor = $state<string | null | undefined>(undefined);
	let loading = $state(false);
	let loadError = $state<string | null>(null);
	$effect.pre(() => {
		void data.tag.slug;
		more = [];
		moreCursor = undefined;
		loadError = null;
	});

	let tiles = $derived.by(() => {
		const seen = new Set(data.tiles.map((t) => t.id));
		return [...data.tiles, ...more.filter((t) => !seen.has(t.id))];
	});
	let nextCursor = $derived(moreCursor === undefined ? data.nextCursor : moreCursor);

	async function loadMore() {
		if (loading || !nextCursor) return;
		loading = true;
		loadError = null;
		try {
			const res = await fetch(
				`/api/tags/${encodeURIComponent(data.tag.slug)}?cursor=${encodeURIComponent(nextCursor)}`
			);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				loadError = readApiError(body, 'Could not load more posts').message;
				return;
			}
			const page = body as { tiles: ExploreTile[]; nextCursor: string | null };
			more = [...more, ...page.tiles];
			moreCursor = page.nextCursor;
		} catch {
			loadError = 'Could not load more posts';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>#{data.tag.name} · Kizuna</title>
	<meta name="description" content="Posts tagged #{data.tag.name} on Kizuna." />
</svelte:head>

<main class="w-full max-w-3xl mx-auto py-6 flex flex-col gap-4">
	<div class="px-4 flex items-center gap-3">
		<a
			href={resolve('/explore')}
			class="size-9 rounded-full flex items-center justify-center text-slate-600 dark:text-dark-muted hover:bg-slate-100 dark:hover:bg-dark-elevated no-underline"
			aria-label="Back to Explore"
		>
			<Icon name="angle-left" />
		</a>
		<h1 class="text-xl font-bold tracking-tight text-slate-950 dark:text-white m-0">
			#{data.tag.name}
		</h1>
	</div>

	{#if tiles.length === 0}
		<p class="px-4 py-16 text-center text-sm text-slate-500 dark:text-dark-muted m-0">
			No posts with this tag right now.
		</p>
	{:else}
		<TileGrid {tiles} />
		{#if nextCursor}
			<LoadMore onLoad={loadMore} {loading} error={loadError} />
		{/if}
	{/if}
</main>
