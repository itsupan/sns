<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import TileGrid from '$lib/components/explore/TileGrid.svelte';
	import LoadMore from '$lib/components/shared/LoadMore.svelte';
	import { followStore } from '$lib/utils/follow.svelte';
	import { formatCount } from '$lib/utils/format';
	import { readApiError } from '$lib/utils/api-error';
	import { toast } from '$lib/utils/toast.svelte';
	import type { ExploreTile, SuggestedCreator } from '$lib/explore/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let more = $state<ExploreTile[]>([]);
	let nextPage = $state(1);
	let moreHasMore = $state<boolean | undefined>(undefined);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let tiles = $derived.by(() => {
		const seen = new Set(data.tiles.map((t) => t.id));
		return [...data.tiles, ...more.filter((t) => !seen.has(t.id))];
	});
	let hasMore = $derived(moreHasMore ?? data.hasMore);

	async function loadMore() {
		if (loading || !hasMore) return;
		loading = true;
		loadError = null;
		try {
			const res = await fetch(`/api/explore?page=${nextPage}`);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				loadError = readApiError(body, 'Could not load more posts').message;
				return;
			}
			const page = body as { tiles: ExploreTile[]; hasMore: boolean };
			more = [...more, ...page.tiles];
			moreHasMore = page.hasMore;
			nextPage++;
		} catch {
			loadError = 'Could not load more posts';
		} finally {
			loading = false;
		}
	}

	async function toggleFollow(creator: SuggestedCreator) {
		if (!data.signedIn) {
			toast.show('Please log in to follow curators');
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() is the base; only a query is added
			await goto(`${resolve('/login')}?redirectTo=${encodeURIComponent('/explore')}`);
			return;
		}
		const next = !followStore.isFollowing(creator.id);
		try {
			await followStore.set(creator.id, next);
		} catch (err) {
			toast.show(err instanceof Error ? err.message : 'Could not update follow');
		}
	}
</script>

<svelte:head>
	<title>Explore · Kizuna</title>
	<meta
		name="description"
		content="Discover photographers, trending tags and new work on Kizuna."
	/>
</svelte:head>

<main class="w-full max-w-3xl mx-auto py-6 flex flex-col gap-6">
	<h1 class="px-4 text-xl font-bold tracking-tight text-slate-950 dark:text-white m-0">Explore</h1>

	{#if data.trending.length > 0}
		<section aria-labelledby="trending-heading" class="flex flex-col gap-2">
			<h2
				id="trending-heading"
				class="px-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-dark-muted m-0"
			>
				Trending tags
			</h2>
			<ul class="flex gap-2 overflow-x-auto no-scrollbar px-4 list-none m-0 p-0">
				{#each data.trending as t (t.slug)}
					<li class="shrink-0 first:ml-4 last:mr-4">
						<a
							href={resolve('/explore/tags/[tag]', { tag: t.slug })}
							class="flex items-center gap-1.5 h-8 px-3 rounded-full bg-slate-100 dark:bg-dark-elevated text-xs font-semibold text-slate-800 dark:text-dark-text no-underline hover:bg-slate-200 dark:hover:bg-dark-hover"
						>
							#{t.name}
							<span class="text-slate-400 font-medium">{formatCount(t.posts)}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.suggestions.length > 0}
		<section aria-labelledby="creators-heading" class="flex flex-col gap-2">
			<h2
				id="creators-heading"
				class="px-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-dark-muted m-0"
			>
				Creators to follow
			</h2>
			<ul class="flex gap-3 overflow-x-auto no-scrollbar list-none m-0 p-0">
				{#each data.suggestions as creator (creator.id)}
					{@const following = followStore.isFollowing(creator.id)}
					<li
						class="shrink-0 first:ml-4 last:mr-4 w-36 rounded-2xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card p-3 flex flex-col items-center gap-2 text-center"
					>
						<a
							href={resolve('/profile/[id]', { id: creator.slug })}
							class="flex flex-col items-center gap-1 no-underline min-w-0 w-full"
						>
							<Avatar src={creator.image ?? ''} name={creator.name} size="lg" />
							<span class="text-sm font-semibold text-slate-900 dark:text-dark-text truncate w-full"
								>{creator.name}</span
							>
							<span class="text-[11px] text-slate-500 dark:text-dark-muted truncate w-full">
								{creator.mutuals > 0
									? `Followed by ${creator.mutuals} you follow`
									: `${formatCount(creator.followersCount)} followers`}
							</span>
						</a>
						<button
							type="button"
							class="w-full h-8 rounded-full text-xs font-semibold border-0 cursor-pointer disabled:opacity-50 {following
								? 'bg-slate-100 text-slate-800 dark:bg-dark-elevated dark:text-dark-text'
								: 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'}"
							disabled={followStore.isPending(creator.id)}
							aria-pressed={following}
							aria-label="{following ? 'Unfollow' : 'Follow'} {creator.name}"
							onclick={() => toggleFollow(creator)}
						>
							{following ? 'Following' : 'Follow'}
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section aria-label="Posts to discover">
		{#if tiles.length === 0}
			<div class="mx-4 py-16 flex flex-col items-center gap-2 text-center">
				<Icon name="compass-alt" class="text-3xl text-slate-300" />
				<p class="text-sm font-semibold text-slate-900 dark:text-dark-text m-0">
					Nothing new to explore yet
				</p>
				<p class="text-xs text-slate-500 dark:text-dark-muted m-0">
					New posts from people you don't follow will show up here.
				</p>
			</div>
		{:else}
			<TileGrid {tiles} />
			{#if hasMore}
				<LoadMore onLoad={loadMore} {loading} error={loadError} />
			{/if}
		{/if}
	</section>
</main>
