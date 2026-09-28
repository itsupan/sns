<script lang="ts">
	import SidebarNav from '$lib/components/shared/SidebarNav.svelte';
	import StoriesBar from '$lib/components/feed/StoriesBar.svelte';
	import CreatePostBox from '$lib/components/feed/CreatePostBox.svelte';
	import PostCard from '$lib/components/feed/PostCard.svelte';
	import RightSidebar from '$lib/components/feed/RightSidebar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import type { PageData } from './$types';
	import type { PostData } from '$lib/components/feed/PostCard.svelte';
	import { readApiError } from '$lib/utils/api-error';

	const DEFAULT_POSTS: PostData[] = [
		{
			id: 'post-1',
			author: {
				name: 'Elena Rostova',
				handle: '@elena.rostova',
				avatar:
					'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
				location: 'Copenhagen, Denmark',
				timeAgo: '3h ago'
			},
			title: 'Quiet Brutalism: Concrete Light & Shadows',
			description:
				'A study on natural dawn illumination casting geometric shadows across raw exposed concrete in the central atrium. Shot on 35mm f/1.4. The spatial tension transforms throughout the winter solstice.',
			image:
				'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80',
			tags: ['#MinimalArchitecture', '#LightAndSpace', '#DesignArchive'],
			likes: 842,
			commentsCount: 46,
			repostsCount: 12,
			commentPreview: {
				author: 'marcus_k',
				content: 'The texture gradation is immaculate. Concrete takes light like velvet here.'
			}
		},
		{
			id: 'post-2',
			author: {
				name: 'Kai Takahashi',
				handle: '@kai.raw',
				avatar:
					'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
				location: 'Kyoto, Japan',
				timeAgo: '5h ago'
			},
			title: 'Wabi-Sabi Clay & Stoneware Forms',
			description:
				'Hand-pinched Shigaraki stoneware fired in an anagama kiln over seven days. The ash melt creates an unrepeatable landscape of mineral hues and subtle texture.',
			image:
				'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=1200&auto=format&fit=crop&q=80',
			tags: ['#KyotoCeramics', '#WabiSabi', '#JapaneseCraft'],
			likes: 618,
			commentsCount: 29,
			repostsCount: 8,
			commentPreview: {
				author: 'sophia_v',
				content: 'The natural wood ash glaze turned out breathtaking.'
			}
		}
	];

	let { data }: { data?: PageData } = $props();
	// Page size comes from FEED_PAGE_SIZE via the server load; the fallback only applies without data.
	let pageSize = $derived(data?.pageSize ?? 10);

	let initialPosts = $derived(data?.posts && data.posts.length > 0 ? data.posts : DEFAULT_POSTS);
	let userCreatedPosts = $state<PostData[]>([]);
	let paginatedPosts = $state<PostData[]>([]);
	// Keyset cursor for the next page; null once the feed is exhausted. `undefined` = use SSR's.
	let loadedCursor = $state<string | null | undefined>(undefined);
	let nextCursor = $derived(loadedCursor !== undefined ? loadedCursor : (data?.nextCursor ?? null));
	let hasMore = $derived(nextCursor !== null);
	let loadingMore = $state(false);
	let loadError = $state<string | null>(null);
	let sentinelEl = $state<HTMLDivElement | null>(null);

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

	$effect(() => {
		if (!sentinelEl || !hasMore || loadError) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const [entry] = entries;
				if (entry?.isIntersecting && !loadingMore && hasMore) {
					loadNextPage();
				}
			},
			{
				rootMargin: '350px 0px'
			}
		);

		observer.observe(sentinelEl);

		return () => {
			observer.disconnect();
		};
	});
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

		{#if loadError}
			<div class="py-8 flex flex-col items-center gap-2 text-center px-4" role="alert">
				<p class="text-sm text-slate-600 dark:text-slate-300">{loadError}</p>
				<button
					type="button"
					class="text-xs font-medium underline text-slate-800 dark:text-slate-200"
					onclick={loadNextPage}>Try again</button
				>
			</div>
		{:else if hasMore}
			<!-- Sentinel element positioned preemptively for seamless infinite scroll -->
			<div
				bind:this={sentinelEl}
				data-testid="feed-sentinel"
				class="h-8 w-full -mt-2 pointer-events-none"
				aria-hidden="true"
			></div>
		{/if}

		{#if loadingMore}
			<div
				class="py-8 flex flex-col items-center justify-center gap-2.5 text-slate-400 dark:text-slate-500"
				aria-live="polite"
				aria-busy="true"
			>
				<div
					class="size-6 border-2 border-slate-300 dark:border-slate-700 border-t-slate-800 dark:border-t-slate-200 rounded-full animate-spin"
				></div>
				<span class="text-xs font-mono tracking-wider uppercase text-slate-500 dark:text-slate-400"
					>Loading posts...</span
				>
			</div>
		{:else if !hasMore && posts.length > 0}
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
	<RightSidebar class="hidden lg:flex" />
</div>
