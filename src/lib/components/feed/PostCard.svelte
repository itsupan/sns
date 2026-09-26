<script lang="ts">
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';
	import SheetAction from '$lib/components/shared/SheetAction.svelte';
	import { formatCount } from '$lib/utils/format';
	import { toast } from '$lib/utils/toast.svelte';

	export interface PostAuthor {
		name: string;
		handle: string;
		avatar: string;
		location?: string;
		timeAgo?: string;
	}

	export interface PostComment {
		author: string;
		content: string;
	}

	export interface PostData {
		id: string;
		author: PostAuthor;
		title: string;
		description: string;
		image: string;
		cameraMeta?: string;
		tags: string[];
		likes: number;
		commentsCount: number;
		repostsCount: number;
		commentPreview?: PostComment;
		liked?: boolean;
		saved?: boolean;
	}

	interface Props {
		post?: PostData;
		class?: string;
		/** Load the image eagerly (first post in the feed, for LCP). */
		priority?: boolean;
		onLike?: (liked: boolean) => void;
		onSave?: (saved: boolean) => void;
	}

	const defaultPost: PostData = {
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
		cameraMeta: '35mm · ISO 200',
		tags: ['#MinimalArchitecture', '#LightAndSpace', '#DesignArchive'],
		likes: 842,
		commentsCount: 46,
		repostsCount: 12,
		commentPreview: {
			author: 'marcus_k',
			content: 'The texture gradation is immaculate. Concrete takes light like velvet here.'
		}
	};

	let {
		post = defaultPost,
		class: className = '',
		priority = false,
		onLike,
		onSave
	}: Props = $props();

	let likedOverride = $state<boolean | null>(null);
	let savedOverride = $state<boolean | null>(null);
	let likesDelta = $state(0);
	let likePop = $state(0);
	let burst = $state(0);
	let optionsOpen = $state(false);

	let isLiked = $derived(likedOverride !== null ? likedOverride : (post.liked ?? false));
	let isSaved = $derived(savedOverride !== null ? savedOverride : (post.saved ?? false));
	let likesCount = $derived(post.likes + likesDelta);

	function haptic() {
		navigator.vibrate?.(10);
	}

	function setLiked(next: boolean) {
		if (next === isLiked) return;
		likedOverride = next;
		likesDelta += next ? 1 : -1;
		if (next) likePop++;
		haptic();
		onLike?.(next);
	}

	function toggleLike() {
		setLiked(!isLiked);
	}

	function toggleSave() {
		const next = !isSaved;
		savedOverride = next;
		haptic();
		toast.show(next ? 'Saved to your collection' : 'Removed from saved');
		onSave?.(next);
	}

	// Double-tap the photo to like (never un-likes, same as native apps).
	let lastTap = 0;
	function handleMediaTap() {
		const now = Date.now();
		if (now - lastTap < 300) {
			burst++;
			setLiked(true);
			lastTap = 0;
		} else {
			lastTap = now;
		}
	}

	function postUrl() {
		return `${window.location.origin}/#${post.id}`;
	}

	async function copyLink() {
		optionsOpen = false;
		try {
			await navigator.clipboard.writeText(postUrl());
			toast.show('Link copied');
		} catch {
			toast.show('Could not copy link');
		}
	}

	async function share() {
		optionsOpen = false;
		if (navigator.share) {
			try {
				await navigator.share({ title: post.title || post.author.name, url: postUrl() });
			} catch {
				// User dismissed the native share sheet.
			}
		} else {
			await copyLink();
		}
	}

	const actionButton =
		'min-w-11 h-11 -my-1 flex items-center justify-center gap-1.5 rounded-full transition cursor-pointer border-0 bg-transparent active:scale-90';
</script>

<article
	id={post.id}
	class="post-card w-full flex flex-col bg-white dark:bg-dark-card border-y sm:border border-slate-100 dark:border-dark-border rounded-none sm:rounded-3xl pt-3 pb-2 sm:p-7 mb-2 sm:mb-6 shadow-none sm:shadow-xs dark:shadow-none transition-colors duration-200 {className}"
	aria-labelledby={post.title ? `post-title-${post.id}` : undefined}
	aria-label={post.title ? undefined : `Post by ${post.author.name}`}
>
	<!-- Post Header: Author info & options -->
	<header class="flex items-center justify-between px-4 sm:px-0">
		<div class="flex items-center gap-3 min-w-0">
			<Avatar src={post.author.avatar} name={post.author.name} size="md" />
			<div class="flex flex-col min-w-0">
				<div class="flex items-center gap-1.5 leading-tight min-w-0">
					<span class="font-semibold text-sm text-slate-900 dark:text-dark-text truncate">
						{post.author.name}
					</span>
					<span class="text-xs text-slate-500 dark:text-dark-muted truncate">
						{post.author.handle}
					</span>
				</div>
				{#if post.author.location || post.author.timeAgo}
					<span class="text-xs text-slate-500 dark:text-dark-subtle mt-0.5 truncate">
						{[post.author.location, post.author.timeAgo].filter(Boolean).join(' • ')}
					</span>
				{/if}
			</div>
		</div>

		<button
			type="button"
			class="size-11 -mr-2 shrink-0 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-hover active:scale-90 transition cursor-pointer border-0 bg-transparent"
			aria-label="Post options"
			aria-haspopup="dialog"
			onclick={() => (optionsOpen = true)}
		>
			<Icon name="menu-dots" class="text-base" />
		</button>
	</header>

	<!-- Title -->
	{#if post.title}
		<h2
			id={`post-title-${post.id}`}
			class="px-4 sm:px-0 text-lg sm:text-xl font-bold text-slate-950 dark:text-white mt-3 sm:mt-4 mb-3 tracking-tight leading-snug"
		>
			{post.title}
		</h2>
	{:else}
		<div class="h-3"></div>
	{/if}

	<!-- Media: full-bleed on phones, rounded on larger screens. Double-tap to like. -->
	{#if post.image}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="media-container relative w-full aspect-[4/5] sm:aspect-[16/10] rounded-none sm:rounded-2xl overflow-hidden bg-slate-100 dark:bg-dark-elevated mb-3 sm:mb-4 group select-none"
			onclick={handleMediaTap}
		>
			<img
				src={post.image}
				alt={post.title || `Photo by ${post.author.name}`}
				sizes="(min-width: 672px) 672px, 100vw"
				class="w-full h-full object-cover transition-transform duration-300 sm:group-hover:scale-[1.01] pointer-events-none"
				loading={priority ? 'eager' : 'lazy'}
				fetchpriority={priority ? 'high' : 'auto'}
				decoding="async"
				draggable="false"
			/>
			{#key burst}
				{#if burst > 0}
					<div
						class="absolute inset-0 flex items-center justify-center pointer-events-none"
						aria-hidden="true"
					>
						<Icon
							name="heart"
							type="sr"
							class="text-white text-[88px] drop-shadow-lg animate-heart-burst"
						/>
					</div>
				{/if}
			{/key}
			{#if post.cameraMeta}
				<div
					class="camera-badge absolute bottom-3 right-3 bg-black/75 backdrop-blur-xs text-white text-[11px] font-mono px-3 py-1 rounded-md tracking-wider select-none shadow-sm"
				>
					{post.cameraMeta}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Action Bar: sits right under the media on phones, like native feeds -->
	<div
		class="action-bar flex items-center justify-between px-2 sm:px-0 sm:py-2 sm:order-1 sm:border-t border-slate-100 dark:border-dark-border text-slate-700 dark:text-dark-muted text-sm sm:text-xs font-medium"
	>
		<div class="flex items-center gap-0 sm:gap-3">
			<button
				type="button"
				class="{actionButton} px-2 {isLiked
					? 'text-rose-500 font-semibold'
					: 'hover:text-slate-900 dark:hover:text-dark-text'}"
				onclick={toggleLike}
				aria-label="Like post"
				aria-pressed={isLiked}
			>
				{#key likePop}
					<Icon
						name="heart"
						type={isLiked ? 'sr' : 'rr'}
						class="text-xl sm:text-base {likePop ? 'animate-heart-pop' : ''}"
					/>
				{/key}
				<span>{formatCount(likesCount)}</span>
			</button>

			<button
				type="button"
				class="{actionButton} px-2 hover:text-slate-900 dark:hover:text-dark-text"
				aria-label="Comments"
				onclick={() => toast.show('Comments are coming soon')}
			>
				<Icon name="comment" class="text-xl sm:text-base" />
				<span>{formatCount(post.commentsCount)}</span>
			</button>

			<button
				type="button"
				class="{actionButton} px-2 hover:text-slate-900 dark:hover:text-dark-text"
				aria-label="Repost"
				onclick={() => toast.show('Reposts are coming soon')}
			>
				<Icon name="arrows-repeat" class="text-xl sm:text-base" />
				<span>{formatCount(post.repostsCount)}</span>
			</button>
		</div>

		<div class="flex items-center">
			<button
				type="button"
				class="{actionButton} {isSaved
					? 'text-blue-600 dark:text-kizuna-blue'
					: 'hover:text-slate-900 dark:hover:text-dark-text'}"
				onclick={toggleSave}
				aria-label={isSaved ? 'Remove bookmark' : 'Save bookmark'}
				aria-pressed={isSaved}
			>
				<Icon name="bookmark" type={isSaved ? 'sr' : 'rr'} class="text-xl sm:text-base" />
			</button>

			<button
				type="button"
				class="{actionButton} hover:text-slate-900 dark:hover:text-dark-text"
				aria-label="Share post"
				onclick={share}
			>
				<Icon name="paper-plane" class="text-xl sm:text-base" />
			</button>
		</div>
	</div>

	<div class="px-4 sm:px-0 flex flex-col">
		<!-- Caption / Description -->
		{#if post.description}
			<p
				class="text-sm leading-relaxed text-slate-700 dark:text-dark-muted mt-1.5 sm:mt-0 mb-3 line-clamp-3 sm:line-clamp-none"
			>
				{post.description}
			</p>
		{/if}

		<!-- Tags -->
		{#if post.tags && post.tags.length > 0}
			<div
				class="flex items-center gap-2 mb-3 sm:mb-4.5 overflow-x-auto no-scrollbar sm:flex-wrap -mx-4 px-4 sm:mx-0 sm:px-0"
			>
				{#each post.tags as tag (tag)}
					<button
						type="button"
						class="shrink-0 text-xs font-medium px-3 h-8 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-muted hover:bg-slate-200 dark:hover:bg-dark-hover hover:text-slate-900 dark:hover:text-dark-text active:scale-95 transition border-0 cursor-pointer"
						onclick={() => toast.show('Tag pages are coming soon')}
					>
						{tag}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<div class="px-4 sm:px-0 sm:order-2">
		<!-- Comment Preview -->
		{#if post.commentPreview}
			<button
				type="button"
				class="comment-preview w-full text-left mb-1 sm:mt-3 sm:mb-0 p-3 rounded-xl bg-slate-50 dark:bg-dark-elevated text-xs leading-normal flex items-center justify-between gap-3 text-slate-700 dark:text-dark-muted border-0 cursor-pointer active:bg-slate-100 dark:active:bg-dark-hover"
				onclick={() => toast.show('Comments are coming soon')}
			>
				<span class="truncate">
					<strong class="font-semibold text-slate-900 dark:text-dark-text">
						{post.commentPreview.author}
					</strong>
					<span class="ml-2">{post.commentPreview.content}</span>
				</span>
				<span
					class="reply-link text-[11px] font-medium text-slate-500 dark:text-dark-muted shrink-0"
				>
					View all {formatCount(post.commentsCount)}
				</span>
			</button>
		{/if}
	</div>
</article>

<BottomSheet bind:open={optionsOpen} title="Post options">
	<SheetAction
		icon="bookmark"
		label={isSaved ? 'Remove from saved' : 'Save'}
		onclick={() => {
			optionsOpen = false;
			toggleSave();
		}}
	/>
	<SheetAction icon="paper-plane" label="Share" onclick={share} />
	<SheetAction icon="link" label="Copy link" onclick={copyLink} />
	<SheetAction
		icon="flag"
		label="Report"
		danger
		onclick={() => {
			optionsOpen = false;
			toast.show('Thanks — our team will review this post');
		}}
	/>
</BottomSheet>
