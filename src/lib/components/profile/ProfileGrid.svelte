<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/shared/Icon.svelte';
	import LoadMore from '$lib/components/shared/LoadMore.svelte';
	import { TEXT_BACKGROUNDS } from '$lib/post-backgrounds';
	import { stripFormatting } from '$lib/formatting';
	import PostCard, { type PostData } from '$lib/components/feed/PostCard.svelte';
	import { formatCount } from '$lib/utils/format';
	import { readApiError } from '$lib/utils/api-error';
	import { GRID_IMAGE_WIDTHS, imageSrcset } from '$lib/utils/image';
	import type { TabId, ViewMode } from './ProfileTabs.svelte';

	export interface GridItem {
		id: string;
		title: string;
		image: string;
		/** Alt text of `image`, when the author wrote one. */
		alt?: string;
		/** Type of `image`; 'none' for text-only posts. Inferred from the URL when missing. */
		mediaType?: 'image' | 'video' | 'none';
		likes: number;
		comments: number;
		isCarousel?: boolean;
		cameraMeta?: string;
		description?: string;
		tags?: string[];
		date?: string;
		location?: string;
		/** List view renders the full post with `PostCard`. */
		post: PostData;
	}

	interface Props {
		items?: GridItem[];
		activeTab?: TabId;
		viewMode?: ViewMode;
		class?: string;
		/** Whose profile this is, for the empty state. */
		userName?: string;
		isOwnProfile?: boolean;
		/** The viewer's most recently saved posts (own profile only); "See all" opens /saved. */
		savedPosts?: GridItem[];
		/** Whose posts `items` are, and the cursor of the page after them; null when there is none. */
		userId?: string;
		nextCursor?: string | null;
	}

	let {
		items = [],
		activeTab = 'grid',
		viewMode = 'grid',
		class: className = '',
		userName,
		isOwnProfile = true,
		savedPosts = [],
		userId,
		nextCursor = null
	}: Props = $props();

	/** How wide a grid cell renders: a third of the page, which stops growing at 1152px. */
	const GRID_CELL_SIZES = '(min-width: 1152px) 360px, 33vw';
	// Posts the author deleted or edited from list view, so grid and compact views match.
	let removedIds = $state<Record<string, boolean>>({});
	let updatedPosts = $state<Record<string, PostData>>({});

	/** Pages loaded while scrolling, appended after the server-rendered first page. */
	let more = $state<GridItem[]>([]);
	let moreCursor = $state<string | null | undefined>(undefined);
	let loadingMore = $state(false);
	let loadError = $state<string | null>(null);
	// SvelteKit reuses this component between profiles; drop the previous one's pages.
	$effect.pre(() => {
		void userId;
		more = [];
		moreCursor = undefined;
		loadError = null;
	});

	let cursor = $derived(moreCursor === undefined ? nextCursor : moreCursor);

	let allItems = $derived.by(() => {
		const seen = new Set(items.map((item) => item.id));
		return [...items, ...more.filter((item) => !seen.has(item.id))];
	});

	let visibleItems = $derived<GridItem[]>(
		allItems
			.filter((item) => !removedIds[item.id])
			.map((item): GridItem => {
				const updated = updatedPosts[item.id];
				return updated
					? {
							...item,
							post: updated,
							title: updated.title || updated.description.slice(0, 40),
							image: updated.mediaItems?.[0]?.url ?? updated.image,
							mediaType: updated.mediaItems?.[0]?.type ?? 'none',
							isCarousel: (updated.mediaItems?.length ?? 0) > 1,
							description: updated.description,
							tags: updated.tags,
							location: updated.location
						}
					: item;
			})
	);

	function kindOf(item: GridItem): 'image' | 'video' | 'none' {
		if (!item.image) return 'none';
		if (item.mediaType === 'video' || /\.(mp4|webm|mov)(\?.*)?$/i.test(item.image)) return 'video';
		return 'image';
	}

	function handleDeleted(id: string) {
		removedIds[id] = true;
	}

	function handleUpdated(next: PostData) {
		updatedPosts[next.id] = next;
	}

	async function loadMore() {
		if (!userId || !cursor || loadingMore) return;
		loadingMore = true;
		loadError = null;
		try {
			const res = await fetch(
				`/api/users/${encodeURIComponent(userId)}/posts?cursor=${encodeURIComponent(cursor)}`
			);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				loadError = readApiError(body, 'Could not load more posts').message;
				return;
			}
			const page = body as { posts: GridItem[]; nextCursor: string | null };
			more = [...more, ...page.posts];
			moreCursor = page.nextCursor;
		} catch {
			loadError = 'Could not load more posts';
		} finally {
			loadingMore = false;
		}
	}

	function openItem(item: GridItem) {
		goto(resolve('/post/[id]', { id: item.id }));
	}
</script>

<!-- Square/portrait preview for any post: photo, first video frame, or its text. -->
{#snippet preview(item: GridItem, textSize: string, sizes: string)}
	{@const kind = kindOf(item)}
	{#if kind === 'image'}
		<img
			src={item.image}
			alt={item.alt || item.title}
			srcset={imageSrcset(item.image, GRID_IMAGE_WIDTHS)}
			{sizes}
			class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
			loading="lazy"
			decoding="async"
		/>
	{:else if kind === 'video'}
		<video
			src={item.image}
			muted
			playsinline
			preload="metadata"
			class="w-full h-full object-cover pointer-events-none"
			aria-label={item.title}
		></video>
		<div
			class="absolute bottom-2 left-2 p-1 rounded-md bg-black/50 text-white flex items-center"
			aria-hidden="true"
		>
			<Icon name="play" type="sr" class="text-[10px]" />
		</div>
	{:else if item.post.background}
		<div
			class="w-full h-full flex items-center justify-center p-3 sm:p-5 text-center text-white font-semibold {TEXT_BACKGROUNDS[
				item.post.background
			]}"
		>
			<span class="line-clamp-5 leading-snug {textSize}"
				>{stripFormatting(item.post.description)}</span
			>
		</div>
	{:else}
		<div
			class="w-full h-full flex flex-col items-center justify-center gap-1 p-3 sm:p-5 bg-slate-200/70 dark:bg-dark-elevated text-center"
		>
			{#if item.post.title}
				<span
					class="font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug {textSize}"
				>
					{item.post.title}
				</span>
			{/if}
			<span class="text-slate-600 dark:text-dark-muted line-clamp-4 leading-snug {textSize}">
				{item.description || item.title}
			</span>
		</div>
	{/if}
{/snippet}

<div class="w-full {className}">
	<!-- 1. CURATED GRID TAB -->
	{#if activeTab === 'grid'}
		{#if visibleItems.length === 0}
			<div class="flex flex-col items-center justify-center py-16 px-4 text-center">
				<div
					class="size-16 rounded-full bg-slate-100 dark:bg-dark-elevated flex items-center justify-center mb-4 text-slate-400 dark:text-dark-muted"
				>
					<Icon name="camera" class="text-2xl" />
				</div>
				<h3 class="text-base font-bold text-slate-900 dark:text-white mb-1">No posts yet</h3>
				<p class="text-xs text-slate-500 dark:text-dark-muted max-w-sm mb-5">
					{#if isOwnProfile}
						When you share photos or architectural studies, they will appear here on your profile.
					{:else}
						{userName || 'This user'} hasn't shared any posts yet.
					{/if}
				</p>
				{#if isOwnProfile}
					<a
						href={resolve('/')}
						class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-950 font-semibold text-xs transition hover:opacity-90 no-underline shadow-xs"
					>
						<Icon name="plus" class="text-xs" />
						<span>Create your first post</span>
					</a>
				{/if}
			</div>
			<!-- A. GRID VIEW MODE (3 Columns) -->
		{:else if viewMode === 'grid'}
			<div class="grid grid-cols-3 gap-0.5 sm:gap-4 md:gap-6 py-0.5 sm:py-6">
				{#each visibleItems as item (item.id)}
					<button
						type="button"
						class="group relative w-full aspect-square overflow-hidden rounded-2xl bg-slate-100 dark:bg-dark-elevated cursor-pointer border-0 p-0 text-left focus:outline-none"
						onclick={() => openItem(item)}
						aria-label={`View ${item.post.pinned ? 'pinned ' : ''}post ${item.title}`}
					>
						{@render preview(item, 'text-[11px] sm:text-sm', GRID_CELL_SIZES)}

						{#if item.post.pinned}
							<div
								class="absolute top-2 left-2 sm:top-3 sm:left-3 p-1 rounded-md bg-black/50 backdrop-blur-xs text-white"
								aria-hidden="true"
							>
								<Icon name="pin" class="text-xs sm:text-sm drop-shadow-xs" />
							</div>
						{/if}

						<!-- Multi-photo Carousel Indicator Icon -->
						{#if item.isCarousel}
							<div
								class="absolute top-2 right-2 sm:top-3 sm:right-3 p-1 rounded-md bg-black/50 backdrop-blur-xs text-white"
								aria-hidden="true"
							>
								<Icon name="copy" class="text-xs sm:text-sm drop-shadow-xs" />
							</div>
						{/if}

						<!-- Desktop Hover Overlay with Likes & Comments -->
						<div
							class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden sm:flex items-center justify-center gap-6 text-white text-sm font-semibold pointer-events-none"
							aria-hidden="true"
						>
							<div class="flex items-center gap-2">
								<Icon name="heart" class="text-base" />
								<span>{formatCount(item.likes)}</span>
							</div>
							<div class="flex items-center gap-2">
								<Icon name="comment-alt" class="text-base" />
								<span>{formatCount(item.comments)}</span>
							</div>
						</div>
					</button>
				{/each}
			</div>

			<!-- B. FEED / LIST VIEW MODE (Full-width post cards) -->
		{:else if viewMode === 'feed'}
			<div class="flex flex-col max-w-2xl mx-auto w-full pt-2 sm:pt-4">
				{#each visibleItems as item (item.id)}
					<PostCard
						post={item.post}
						showFollow={false}
						showPinned
						onDelete={handleDeleted}
						onUpdate={handleUpdated}
					/>
				{/each}
			</div>

			<!-- C. COMPACT VIEW MODE (Dense Table / Archive list) -->
		{:else if viewMode === 'compact'}
			<div
				class="w-full flex flex-col divide-y divide-slate-100 dark:divide-dark-border py-4 px-2 sm:px-0"
			>
				{#each visibleItems as item (item.id)}
					<button
						type="button"
						class="w-full flex items-center justify-between gap-4 py-3 sm:py-3.5 hover:bg-slate-50/80 dark:hover:bg-dark-elevated/40 px-2 sm:px-3 rounded-xl transition-colors cursor-pointer border-0 bg-transparent text-left"
						onclick={() => openItem(item)}
						aria-label={`View ${item.post.pinned ? 'pinned ' : ''}post ${item.title}`}
					>
						<!-- Left: Thumbnail + Title -->
						<div class="flex items-center gap-3.5 min-w-0">
							<div
								class="group relative size-12 sm:size-14 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-dark-elevated"
							>
								{@render preview(item, 'text-[8px]', '56px')}
							</div>
							<div class="flex flex-col min-w-0">
								<span
									class="flex items-center gap-1.5 font-semibold text-sm text-slate-900 dark:text-white min-w-0"
								>
									{#if item.post.pinned}
										<Icon name="pin" class="text-xs shrink-0 text-slate-500 dark:text-dark-muted" />
									{/if}
									<span class="truncate">{item.title}</span>
								</span>
								{#if item.cameraMeta || item.tags?.length}
									<span class="text-xs text-slate-400 dark:text-dark-muted truncate">
										{item.cameraMeta || item.tags?.join(' ')}
									</span>
								{/if}
							</div>
						</div>

						<!-- Center: Location & Date -->
						<div class="hidden md:flex flex-col text-left">
							{#if item.location}
								<span class="text-xs font-medium text-slate-700 dark:text-dark-text">
									{item.location}
								</span>
							{/if}
							<span class="text-[11px] text-slate-400">{item.date}</span>
						</div>

						<!-- Right: Stats & Action -->
						<div
							class="flex items-center gap-4 sm:gap-6 shrink-0 text-xs text-slate-500 dark:text-dark-muted"
						>
							<div class="flex items-center gap-1.5">
								<Icon name="heart" class="text-sm" />
								<span>{formatCount(item.likes)}</span>
							</div>
							<div class="hidden sm:flex items-center gap-1.5">
								<Icon name="comment-alt" class="text-sm" />
								<span>{formatCount(item.comments)}</span>
							</div>
							<span
								class="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-white"
							>
								View
							</span>
						</div>
					</button>
				{/each}
			</div>
		{/if}

		{#if userId && cursor}
			<LoadMore onLoad={loadMore} loading={loadingMore} error={loadError} />
		{/if}

		<!-- 2. SAVED TAB -->
	{:else if activeTab === 'saved'}
		{#if savedPosts.length === 0}
			<div class="flex flex-col items-center justify-center py-16 px-4 text-center">
				<div
					class="size-16 rounded-full bg-slate-100 dark:bg-dark-elevated flex items-center justify-center mb-4 text-slate-400 dark:text-dark-muted"
				>
					<Icon name="bookmark" class="text-2xl" />
				</div>
				<h3 class="text-base font-bold text-slate-900 dark:text-white mb-1">No saved posts</h3>
				<p class="text-xs text-slate-500 dark:text-dark-muted max-w-sm">
					Save posts to revisit them later in your private archive.
				</p>
			</div>
		{:else}
			<div class="grid grid-cols-3 gap-0.5 sm:gap-1 py-0.5 sm:py-1">
				{#each savedPosts as item (item.id)}
					<button
						type="button"
						class="group relative w-full aspect-square overflow-hidden bg-slate-100 dark:bg-dark-elevated cursor-pointer border-0 p-0 text-left focus:outline-none"
						onclick={() => openItem(item)}
						aria-label={`View saved post ${item.title}`}
					>
						{@render preview(item, 'text-[11px] sm:text-sm', GRID_CELL_SIZES)}
						<div class="absolute top-2 right-2 text-white drop-shadow-md">
							<Icon name="bookmark" class="text-sm text-blue-500" />
						</div>
					</button>
				{/each}
			</div>
			<a
				href={resolve('/saved')}
				class="block text-center py-4 text-xs font-semibold text-slate-600 dark:text-dark-muted hover:text-slate-900 dark:hover:text-white no-underline"
			>
				See all saved posts
			</a>
		{/if}
	{/if}
</div>
