<script lang="ts">
	import SidebarNav from '$lib/components/shared/SidebarNav.svelte';
	import StoriesBar from '$lib/components/feed/StoriesBar.svelte';
	import CreatePostBox from '$lib/components/feed/CreatePostBox.svelte';
	import PostCard from '$lib/components/feed/PostCard.svelte';
	import RightSidebar from '$lib/components/feed/RightSidebar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import LoadMore from '$lib/components/shared/LoadMore.svelte';
	import type { PageData } from './$types';
	import type { PostData } from '$lib/components/feed/PostCard.svelte';
	import { readApiError } from '$lib/utils/api-error';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';

	let { data }: { data?: PageData } = $props();
	// Page size comes from FEED_PAGE_SIZE via the server load; the fallback only applies without data.
	let pageSize = $derived(data?.pageSize ?? 10);

	let initialPosts = $derived(data?.posts ?? []);
	let userCreatedPosts = $state<PostData[]>([]);
	let paginatedPosts = $state<PostData[]>([]);
	// Keyset cursor for the next page; null once the feed is exhausted. `undefined` = use SSR's.
	let loadedCursor = $state<string | null | undefined>(undefined);
	let nextCursor = $derived(loadedCursor !== undefined ? loadedCursor : (data?.nextCursor ?? null));
	let hasMore = $derived(nextCursor !== null);
	let loadingMore = $state(false);
	let loadError = $state<string | null>(null);

	let posts = $derived.by(() => {
		const seen: Record<string, boolean> = {};
		const list: PostData[] = [];
		for (const p of userCreatedPosts) {
			if (!seen[p.id]) {
				seen[p.id] = true;
				list.push(p);
			}
		}
		for (const p of initialPosts) {
			if (!seen[p.id]) {
				seen[p.id] = true;
				list.push(p);
			}
		}
		for (const p of paginatedPosts) {
			if (!seen[p.id]) {
				seen[p.id] = true;
				list.push(p);
			}
		}
		return list;
	});

	function handlePublish(newPost: PostData) {
		userCreatedPosts = [newPost, ...userCreatedPosts];
	}

	async function loadNextPage() {
		if (loadingMore || !hasMore) return;
		loadingMore = true;
		loadError = null;
		try {
			const res = await fetch(
				`/api/posts?limit=${pageSize}&cursor=${encodeURIComponent(nextCursor ?? '')}`
			);
			const result = (await res.json().catch(() => null)) as {
				posts?: PostData[];
				nextCursor?: string | null;
			} | null;
			if (!res.ok || !result) {
				loadError = readApiError(result, 'Could not load more posts').message;
				return;
			}
			paginatedPosts = [...paginatedPosts, ...(result.posts ?? [])];
			loadedCursor = result.nextCursor ?? null;
		} catch {
			loadError = 'Could not load more posts';
		} finally {
			loadingMore = false;
		}
	}
</script>

<svelte:head>
	<title>Kizuna — Journal & Visual Feed</title>
	<meta name="description" content="A curated visual space for photographers and minimalists." />
</svelte:head>

<!-- Hidden H1 for accessibility and test suites -->
<h1 class="sr-only">Kizuna home feed</h1>

<div
	class="max-w-7xl mx-auto px-0 lg:px-4 xl:px-6 w-full flex justify-center lg:justify-between gap-0 lg:gap-4 xl:gap-8"
>
	<!-- Left Navigation Column (Desktop & Tablet Landscape) -->
	<SidebarNav class="hidden lg:flex" />

	<!-- Center Main Feed Column (Full width on mobile/tablet portrait, centered on desktop) -->
	<main class="flex-1 max-w-2xl min-w-0 pt-0 pb-4 lg:py-6 mx-auto w-full">
		<StoriesBar />
		<CreatePostBox onPublish={handlePublish} />
		<div class="feed-posts flex flex-col">
			{#each posts as post (post.id)}
				<PostCard {post} priority={post.id === posts[0]?.id} />
			{/each}
		</div>

		{#if posts.length === 0}
			<div
				class="mx-4 lg:mx-0 rounded-3xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card py-16 px-6 flex flex-col items-center gap-2 text-center"
				role={data?.loadFailed ? 'alert' : undefined}
			>
				{#if data?.loadFailed}
					<Icon name="exclamation" class="text-3xl text-slate-300" />
					<p class="text-sm font-semibold text-slate-900 dark:text-dark-text m-0">
						Could not load your feed
					</p>
					<button
						type="button"
						class="text-xs font-medium underline text-slate-800 dark:text-slate-200"
						onclick={() => invalidateAll()}>Try again</button
					>
				{:else}
					<Icon name="picture" class="text-3xl text-slate-300" />
					<p class="text-sm font-semibold text-slate-900 dark:text-dark-text m-0">No posts yet</p>
					<p class="text-xs text-slate-500 dark:text-dark-muted m-0">
						Share the first one, or
						<a href={resolve('/explore')} class="font-medium underline">find people on Explore</a>.
					</p>
				{/if}
			</div>
		{/if}

		{#if hasMore}
			<LoadMore onLoad={loadNextPage} loading={loadingMore} error={loadError} />
		{:else if posts.length > 0}
			<div class="py-10 flex flex-col items-center justify-center text-center px-4">
				<div
					class="size-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2.5 shadow-xs"
				>
					<Icon name="check" class="text-base" />
				</div>
				<p class="text-sm font-medium text-slate-800 dark:text-slate-200">You're all caught up</p>
				<p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
					You've seen all recent posts from your feed.
				</p>
			</div>
		{/if}
	</main>

	<!-- Right Sidebar Column (Desktop & Tablet Landscape) -->
	<RightSidebar class="hidden lg:flex" suggestions={data?.suggestions} />
</div>
