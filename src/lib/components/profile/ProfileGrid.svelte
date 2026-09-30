<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/shared/Icon.svelte';
	import PostCard, { type PostData } from '$lib/components/feed/PostCard.svelte';
	import { formatCount } from '$lib/utils/format';
	import type { TabId, ViewMode } from './ProfileTabs.svelte';

	export interface GridItem {
		id: string;
		title: string;
		image: string;
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
		/** Full post for real (database) items: list view renders it with `PostCard`. */
		post?: PostData;
	}

	export interface EssayItem {
		id: string;
		title: string;
		subtitle: string;
		coverImage: string;
		readTime: string;
		date: string;
		excerpt: string;
		tags: string[];
	}

	export interface PinnedCollection {
		id: string;
		title: string;
		count: number;
		coverImage: string;
		description: string;
	}

	interface Props {
		items?: GridItem[];
		essays?: EssayItem[];
		collections?: PinnedCollection[];
		activeTab?: TabId;
		viewMode?: ViewMode;
		class?: string;
		onSelectItem?: (item: GridItem) => void;
		user?: {
			name?: string;
			handle?: string;
			image?: string | null;
		};
		isOwnProfile?: boolean;
		/** The viewer's most recently saved posts (own profile only); "See all" opens /saved. */
		savedPosts?: GridItem[];
	}

	const defaultItems: GridItem[] = [
		{
			id: 'g1',
			title: 'Brutalist Spiral Staircase Atrium',
			image:
				'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80',
			likes: 1420,
			comments: 89,
			isCarousel: true,
			cameraMeta: '35mm · ISO 200 · f/2.0',
			description:
				'Continuous cast concrete helical staircase with natural zenital light pouring through the overhead skylight. Shot on Hasselblad 500C/M.',
			tags: ['#Brutalism', '#HelicalStaircase', '#Architecture'],
			date: 'Oct 2025',
			location: 'Copenhagen, Denmark'
		},
		{
			id: 'g2',
			title: 'Scandinavian Light-Filled Kitchen Atrium',
			image:
				'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=1200&auto=format&fit=crop&q=80',
			likes: 954,
			comments: 42,
			cameraMeta: '50mm · ISO 400 · f/2.8',
			description:
				'Sunlight pouring across marble surfaces and custom timber joinery. Natural spatial harmony.',
			tags: ['#InteriorDesign', '#KitchenAtrium', '#NordicLiving'],
			date: 'Sep 2025',
			location: 'Stockholm, Sweden'
		},
		{
			id: 'g3',
			title: 'Water Temple Reflection',
			image:
				'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80',
			likes: 1205,
			comments: 76,
			cameraMeta: '28mm · ISO 100 · f/5.6',
			description:
				'Smooth water plane mirroring architectural mass at twilight. Concrete formwork holes aligned precisely on 45cm grid.',
			tags: ['#TadaoAndo', '#WaterMirror', '#Minimalism'],
			date: 'Aug 2025',
			location: 'Awaji Island, Japan'
		},
		{
			id: 'g4',
			title: 'Curved Glass High-Rise Horizon',
			image:
				'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80',
			likes: 812,
			comments: 31,
			cameraMeta: '80mm · ISO 200 · f/4.0',
			description:
				'Curvilinear curtain wall reflections catching overcast evening stratocumulus clouds.',
			tags: ['#GlassFacade', '#UrbanStudy', '#ScandinavianDesign'],
			date: 'Jul 2025',
			location: 'Helsinki, Finland'
		},
		{
			id: 'g5',
			title: 'Shou Sugi Ban Charred Wood Texture',
			image:
				'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=1200&auto=format&fit=crop&q=80',
			likes: 673,
			comments: 24,
			isCarousel: true,
			cameraMeta: '80mm Planar · ISO 160 · f/2.8',
			description:
				'Carbonized cedar exterior cladding with subtle window reveals. Texture tactile and mineral-like.',
			tags: ['#Yakisugi', '#JapaneseCraft', '#WoodTexture'],
			date: 'Jun 2025',
			location: 'Kyoto, Japan'
		},
		{
			id: 'g6',
			title: 'Solitary Walk on Sea Wall',
			image:
				'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
			likes: 1120,
			comments: 58,
			cameraMeta: '35mm · ISO 400 · f/8.0',
			description:
				'Minimalist figure silhouetted against sea mist on brutalist breakwater concrete rampart.',
			tags: ['#Monochrome', '#SeaWall', '#Solitude'],
			date: 'May 2025',
			location: 'Gotland, Sweden'
		},
		{
			id: 'g7',
			title: 'Geometric Wire Chairs & Concrete Shadows',
			image:
				'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop&q=80',
			likes: 745,
			comments: 19,
			cameraMeta: '50mm · ISO 100 · f/2.0',
			description:
				'Bertoia wire chair diamond mesh projecting complex geometric shadows onto lime-plaster wall.',
			tags: ['#MidCentury', '#ShadowPlay', '#InteriorDesign'],
			date: 'Apr 2025',
			location: 'Stockholm, Sweden'
		},
		{
			id: 'g8',
			title: 'Tower Facade Fenestration Rhythm',
			image:
				'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80',
			likes: 890,
			comments: 37,
			cameraMeta: '135mm · ISO 100 · f/5.6',
			description:
				'Repetitive pre-cast concrete facade elements creating rhythmic optical compression.',
			tags: ['#PrecastConcrete', '#Fenestration', '#TowerFacade'],
			date: 'Mar 2025',
			location: 'London, UK'
		},
		{
			id: 'g9',
			title: 'Curator Plate on Raw Concrete',
			image:
				'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80',
			likes: 1042,
			comments: 63,
			cameraMeta: '50mm · ISO 200 · f/2.8',
			description:
				'Gallery archive signage mounted flush against textured board-formed concrete surface.',
			tags: ['#Typography', '#GallerySignage', '#BoardFormed'],
			date: 'Feb 2025',
			location: 'Copenhagen, Denmark'
		}
	];

	const sampleEssays: EssayItem[] = [
		{
			id: 'e1',
			title: 'Quiet Brutalism: Concrete Light & Shadows in Copenhagen',
			subtitle:
				'A study on natural dawn illumination across raw exposed concrete in the central atrium.',
			coverImage:
				'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=900&auto=format&fit=crop&q=80',
			readTime: '12 min read',
			date: 'Oct 14, 2025',
			excerpt:
				'Architecture is the masterly, correct, and magnificent play of masses brought together in light. When winter sets in along the Øresund, dawn light enters at a 14-degree azimuth...',
			tags: ['#Brutalism', '#LightAndSpace', '#Monograph']
		},
		{
			id: 'e2',
			title: 'The Charred Timber of Kyoto: Shou Sugi Ban & Space',
			subtitle:
				'Exploring tactile surfaces and ancient cedar combustion methods in Kansai architecture.',
			coverImage:
				'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=900&auto=format&fit=crop&q=80',
			readTime: '8 min read',
			date: 'Sep 28, 2025',
			excerpt:
				'To burn wood is not to destroy it, but to confer longevity. Walking through the narrow alleys of Gion and outer Uji, the velvet texture of charred Yakisugi absorbs sound and sunlight alike...',
			tags: ['#KyotoCraft', '#WabiSabi', '#JapaneseArchitecture']
		}
	];

	const sampleCollections: PinnedCollection[] = [
		{
			id: 'col-1',
			title: 'Nordic Concrete Monograph',
			count: 18,
			coverImage:
				'https://images.unsplash.com/photo-1541123437800-1bb1317badc2?w=800&auto=format&fit=crop&q=80',
			description:
				'Exposed aggregate, board-formed walls, and raw spatial mass across Scandinavian public spaces.'
		},
		{
			id: 'col-2',
			title: 'Kansai Craft & Shigaraki Kilns',
			count: 14,
			coverImage:
				'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&auto=format&fit=crop&q=80',
			description:
				'Traditional wood-fired anagama ceramics and architectural masonry in Western Japan.'
		}
	];

	let {
		items = defaultItems,
		essays = sampleEssays,
		collections = sampleCollections,
		activeTab = 'grid',
		viewMode = 'grid',
		class: className = '',
		onSelectItem,
		user,
		isOwnProfile = true,
		savedPosts = []
	}: Props = $props();

	let activeModalItem = $state<GridItem | null>(null);
	// Posts the author deleted or edited from list view, so grid and compact views match.
	let removedIds = $state<Record<string, boolean>>({});
	let updatedPosts = $state<Record<string, PostData>>({});

	let visibleItems = $derived<GridItem[]>(
		items
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
	function openItem(item: GridItem) {
		onSelectItem?.(item);
		// Real posts open their own page (comments, edit, delete); demo items use the lightbox.
		if (item.post) {
			goto(resolve('/post/[id]', { id: item.id }));
			return;
		}
		activeModalItem = item;
	}

	// A native modal <dialog> gives Escape, a focus trap and focus restore for free.
	function showModal(node: HTMLDialogElement) {
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		node.showModal();
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}
</script>

<!-- Square/portrait preview for any post: photo, first video frame, or its text. -->
{#snippet preview(item: GridItem, textSize: string)}
	{@const kind = kindOf(item)}
	{#if kind === 'image'}
		<img
			src={item.image}
			alt={item.title}
			class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
			loading="lazy"
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
	{:else}
		<div
			class="w-full h-full flex flex-col items-center justify-center gap-1 p-3 sm:p-5 bg-slate-200/70 dark:bg-dark-elevated text-center"
		>
			{#if item.post?.title}
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
						{user?.name || 'This user'} hasn't shared any posts yet.
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
						aria-label={`View post ${item.title}`}
					>
						{@render preview(item, 'text-[11px] sm:text-sm')}

						<!-- Multi-photo Carousel Indicator Icon -->
						{#if item.isCarousel}
							<div
								class="absolute top-2 right-2 sm:top-3 sm:right-3 p-1 rounded-md bg-black/50 backdrop-blur-xs text-white"
								aria-hidden="true"
							>
								<Icon name="copy-alt" class="text-xs sm:text-sm drop-shadow-xs" />
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
					{#if item.post}
						<PostCard
							post={item.post}
							showFollow={false}
							onDelete={handleDeleted}
							onUpdate={handleUpdated}
						/>
					{:else}
						<article
							class="mb-2 lg:mb-6 mx-3 sm:mx-0 bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xs dark:shadow-none transition-colors"
						>
							<!-- Header -->
							<div class="flex items-center justify-between mb-3.5">
								<div class="flex items-center gap-3">
									<div
										class="size-10 rounded-full overflow-hidden bg-slate-100 dark:bg-dark-elevated flex items-center justify-center shrink-0"
									>
										{#if user?.image}
											<img
												src={user.image}
												alt={user.name || 'User'}
												class="w-full h-full object-cover"
											/>
										{:else}
											<span
												class="font-bold text-xs text-slate-600 dark:text-dark-text select-none"
											>
												{(user?.name || 'U').slice(0, 1).toUpperCase()}
											</span>
										{/if}
									</div>
									<div class="flex flex-col">
										<div class="flex items-center gap-1.5 leading-tight">
											<span class="font-semibold text-sm text-slate-900 dark:text-white">
												{user?.name || 'User'}
											</span>
											<span class="text-xs text-slate-400">@{user?.handle || 'user'}</span>
										</div>
										<span class="text-xs text-slate-400 mt-0.5">
											{[item.location, item.date].filter(Boolean).join(' • ')}
										</span>
									</div>
								</div>
							</div>

							<!-- Title -->
							<h2 class="text-lg font-bold text-slate-950 dark:text-white mb-3">
								{item.title}
							</h2>

							<!-- Image with camera badge -->
							<button
								type="button"
								class="relative w-full aspect-[16/10] rounded-xl sm:rounded-2xl overflow-hidden bg-slate-100 dark:bg-dark-elevated mb-4 group cursor-pointer border-0 p-0 text-left block"
								onclick={() => openItem(item)}
								aria-label={`View post ${item.title}`}
							>
								<img
									src={item.image}
									alt={item.title}
									class="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
									loading="lazy"
								/>
								{#if item.cameraMeta}
									<div
										class="absolute bottom-3 right-3 bg-black/75 backdrop-blur-xs text-white text-[11px] font-mono px-3 py-1 rounded-md tracking-wider"
									>
										{item.cameraMeta}
									</div>
								{/if}
							</button>

							<!-- Description -->
							{#if item.description}
								<p
									class="text-sm leading-relaxed text-slate-700 dark:text-dark-muted mb-3.5 whitespace-pre-line break-words"
								>
									{item.description}
								</p>
							{/if}

							<!-- Tags -->
							{#if item.tags}
								<div class="flex items-center gap-2 flex-wrap mb-4">
									{#each item.tags as tag (tag)}
										<span
											class="text-xs font-medium px-3 py-1 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-muted"
										>
											{tag}
										</span>
									{/each}
								</div>
							{/if}

							<!-- Counters (demo items have no post to like, save or share) -->
							<div
								class="flex items-center gap-5 pt-3 border-t border-slate-100 dark:border-dark-border text-xs text-slate-600 dark:text-dark-muted"
							>
								<span class="flex items-center gap-1.5">
									<Icon name="heart" class="text-base" />
									{formatCount(item.likes)}
								</span>
								<span class="flex items-center gap-1.5">
									<Icon name="comment-alt" class="text-base" />
									{formatCount(item.comments)}
								</span>
							</div>
						</article>
					{/if}
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
						aria-label={`View post ${item.title}`}
					>
						<!-- Left: Thumbnail + Title -->
						<div class="flex items-center gap-3.5 min-w-0">
							<div
								class="group relative size-12 sm:size-14 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-dark-elevated"
							>
								{@render preview(item, 'text-[8px]')}
							</div>
							<div class="flex flex-col min-w-0">
								<span class="font-semibold text-sm text-slate-900 dark:text-white truncate">
									{item.title}
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

		<!-- 2. EDITORIAL ESSAYS / SERIES TAB -->
	{:else if activeTab === 'essays'}
		{#if essays.length === 0}
			<div class="flex flex-col items-center justify-center py-16 px-4 text-center">
				<div
					class="size-16 rounded-full bg-slate-100 dark:bg-dark-elevated flex items-center justify-center mb-4 text-slate-400 dark:text-dark-muted"
				>
					<Icon name="document" class="text-2xl" />
				</div>
				<h3 class="text-base font-bold text-slate-900 dark:text-white mb-1">
					No essays published yet
				</h3>
				<p class="text-xs text-slate-500 dark:text-dark-muted max-w-sm">
					In-depth architectural monographs and critical essays will appear here.
				</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 px-3 sm:px-0">
				{#each essays as essay (essay.id)}
					<article
						class="bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border rounded-2xl overflow-hidden shadow-xs dark:shadow-none hover:shadow-md transition-shadow flex flex-col"
					>
						<div class="w-full aspect-[16/9] overflow-hidden bg-slate-100 dark:bg-dark-elevated">
							<img
								src={essay.coverImage}
								alt={essay.title}
								class="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
								loading="lazy"
							/>
						</div>
						<div class="p-5 sm:p-6 flex-1 flex flex-col justify-between">
							<div>
								<div class="flex items-center gap-2 text-xs text-slate-400 mb-2">
									<span>{essay.date}</span>
									<span>•</span>
									<span>{essay.readTime}</span>
								</div>
								<h3 class="text-lg font-bold text-slate-950 dark:text-white mb-2 leading-snug">
									{essay.title}
								</h3>
								<p
									class="text-xs sm:text-sm text-slate-600 dark:text-dark-muted leading-relaxed line-clamp-3 mb-4"
								>
									{essay.excerpt}
								</p>
							</div>
							<div
								class="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-dark-border"
							>
								<div class="flex items-center gap-1.5 flex-wrap">
									{#each essay.tags as tag (tag)}
										<span
											class="text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-dark-elevated px-2.5 py-0.5 rounded-full"
										>
											{tag}
										</span>
									{/each}
								</div>
								<button
									type="button"
									class="text-xs font-semibold text-blue-600 dark:text-kizuna-blue hover:underline bg-transparent border-0 cursor-pointer"
								>
									Read Essay →
								</button>
							</div>
						</div>
					</article>
				{/each}
			</div>
		{/if}

		<!-- 3. PINNED COLLECTIONS TAB -->
	{:else if activeTab === 'pinned'}
		{#if collections.length === 0}
			<div class="flex flex-col items-center justify-center py-16 px-4 text-center">
				<div
					class="size-16 rounded-full bg-slate-100 dark:bg-dark-elevated flex items-center justify-center mb-4 text-slate-400 dark:text-dark-muted"
				>
					<Icon name="bookmark" class="text-2xl" />
				</div>
				<h3 class="text-base font-bold text-slate-900 dark:text-white mb-1">No collections yet</h3>
				<p class="text-xs text-slate-500 dark:text-dark-muted max-w-sm">
					Curated photo series and collections will appear here.
				</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 px-3 sm:px-0">
				{#each collections as col (col.id)}
					<div
						class="group bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border rounded-2xl overflow-hidden p-4 shadow-xs dark:shadow-none hover:border-slate-300 dark:hover:border-dark-hover transition-all cursor-pointer"
					>
						<div
							class="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-slate-100 dark:bg-dark-elevated mb-3.5"
						>
							<img
								src={col.coverImage}
								alt={col.title}
								class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
								loading="lazy"
							/>
							<div
								class="absolute bottom-2 right-2 bg-black/75 backdrop-blur-xs text-white text-xs font-semibold px-2.5 py-1 rounded-md"
							>
								{col.count} works
							</div>
						</div>
						<h3 class="text-base font-bold text-slate-900 dark:text-white mb-1">
							{col.title}
						</h3>
						<p class="text-xs text-slate-500 dark:text-dark-muted m-0">
							{col.description}
						</p>
					</div>
				{/each}
			</div>
		{/if}

		<!-- 4. CRITIQUES TAB -->
	{:else if activeTab === 'critiques'}
		<div class="max-w-2xl mx-auto py-8 text-center text-slate-500 dark:text-dark-muted">
			<Icon name="document-signed" class="text-3xl text-slate-400 mb-3" />
			<h3 class="text-base font-bold text-slate-900 dark:text-white mb-1">
				Peer Architectural Critiques
			</h3>
			<p class="text-xs leading-relaxed max-w-md mx-auto">
				Curated critical evaluations and commentary from architectural fellows and gallery curators.
			</p>
		</div>

		<!-- 5. SAVED TAB -->
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
					Save photos and essays to revisit them later in your private archive.
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
						{@render preview(item, 'text-[11px] sm:text-sm')}
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

	<!-- LIGHTBOX MODAL -->
	{#if activeModalItem}
		<dialog
			{@attach showModal}
			class="fixed inset-0 z-50 m-0 size-full max-w-none max-h-none border-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
			aria-label={activeModalItem.title}
			onclose={() => (activeModalItem = null)}
			onclick={(e) => {
				if (e.target === e.currentTarget) e.currentTarget.close();
			}}
		>
			<div
				class="relative max-w-4xl w-full bg-white dark:bg-dark-card rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
			>
				<!-- Modal Image -->
				<div class="flex-1 bg-black flex items-center justify-center min-h-[300px]">
					<img
						src={activeModalItem.image}
						alt={activeModalItem.title}
						class="w-full h-full max-h-[85vh] object-contain"
					/>
				</div>

				<!-- Modal Info Sidebar -->
				<div
					class="w-full md:w-80 p-5 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-100 dark:border-dark-border"
				>
					<div>
						<div
							class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-dark-border"
						>
							<span class="font-bold text-sm text-slate-900 dark:text-white">
								{user?.name || 'User'}
							</span>
							<button
								type="button"
								class="size-8 rounded-full flex items-center justify-center text-slate-500 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors cursor-pointer border-0 bg-transparent"
								onclick={(e) => e.currentTarget.closest('dialog')?.close()}
								aria-label="Close dialog"
							>
								✕
							</button>
						</div>

						<h3 class="text-base font-bold text-slate-950 dark:text-white mt-4 mb-2">
							{activeModalItem.title}
						</h3>
						{#if activeModalItem.description}
							<p
								class="text-xs text-slate-600 dark:text-dark-muted leading-relaxed whitespace-pre-line break-words"
							>
								{activeModalItem.description}
							</p>
						{/if}

						{#if activeModalItem.cameraMeta}
							<div
								class="mt-3 py-2 px-3 rounded-lg bg-slate-50 dark:bg-dark-elevated text-[11px] font-mono text-slate-600 dark:text-dark-muted"
							>
								{activeModalItem.cameraMeta}
							</div>
						{/if}
					</div>

					<div
						class="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-dark-border text-xs text-slate-600 dark:text-dark-muted font-medium"
					>
						<div class="flex items-center gap-1.5">
							<Icon name="heart" class="text-rose-500 text-sm" />
							<span>{activeModalItem.likes} likes</span>
						</div>
						<div class="flex items-center gap-1.5">
							<Icon name="comment-alt" class="text-sm" />
							<span>{activeModalItem.comments} comments</span>
						</div>
					</div>
				</div>
			</div>
		</dialog>
	{/if}
</div>
