<script lang="ts">
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';

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

	let { post = defaultPost, class: className = '', onLike, onSave }: Props = $props();

	let likedOverride = $state<boolean | null>(null);
	let savedOverride = $state<boolean | null>(null);
	let likesDelta = $state(0);

	let isLiked = $derived(likedOverride !== null ? likedOverride : (post.liked ?? false));
	let isSaved = $derived(savedOverride !== null ? savedOverride : (post.saved ?? false));
	let likesCount = $derived(post.likes + likesDelta);

	function toggleLike() {
		const next = !isLiked;
		likedOverride = next;
		likesDelta += next ? 1 : -1;
		onLike?.(next);
	}

	function toggleSave() {
		const next = !isSaved;
		savedOverride = next;
		onSave?.(next);
	}
</script>

<article
	class="post-card w-full bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border rounded-2xl sm:rounded-3xl p-5 sm:p-7 mb-6 shadow-xs dark:shadow-none transition-colors duration-200 {className}"
	aria-labelledby={`post-title-${post.id}`}
>
	<!-- Post Header: Author info & options -->
	<header class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<Avatar src={post.author.avatar} name={post.author.name} size="md" />
			<div class="flex flex-col">
				<div class="flex items-center gap-1.5 flex-wrap leading-tight">
					<span class="font-semibold text-sm text-slate-900 dark:text-dark-text">
						{post.author.name}
					</span>
					<span class="text-xs text-slate-400 dark:text-dark-muted">
						{post.author.handle}
					</span>
				</div>
				{#if post.author.location || post.author.timeAgo}
					<span class="text-xs text-slate-400 dark:text-dark-subtle mt-0.5">
						{[post.author.location, post.author.timeAgo].filter(Boolean).join(' • ')}
					</span>
				{/if}
			</div>
		</div>

		<!-- Options menu button -->
		<button
			type="button"
			class="size-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors duration-150 cursor-pointer border-0 bg-transparent"
			aria-label="Post options"
		>
			<Icon name="menu-dots" class="text-base" />
		</button>
	</header>

	<!-- Title -->
	{#if post.title}
		<h2
			id={`post-title-${post.id}`}
			class="text-lg sm:text-xl font-bold text-slate-950 dark:text-white mt-4 mb-3 tracking-tight leading-snug"
		>
			{post.title}
		</h2>
	{/if}

	<!-- Post Image Media with Camera Meta Badge -->
	{#if post.image}
		<div
			class="media-container relative w-full aspect-[16/10] sm:aspect-[16/10] rounded-xl sm:rounded-2xl overflow-hidden bg-slate-100 dark:bg-dark-elevated mb-4 group"
		>
			<img
				src={post.image}
				alt={post.title || 'Architectural study'}
				class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
				loading="lazy"
			/>
			{#if post.cameraMeta}
				<div
					class="camera-badge absolute bottom-3 right-3 bg-black/75 backdrop-blur-xs text-white text-[11px] font-mono px-3 py-1 rounded-md tracking-wider select-none shadow-sm"
				>
					{post.cameraMeta}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Caption / Description -->
	{#if post.description}
		<p class="text-sm leading-relaxed text-slate-700 dark:text-dark-muted mb-3.5">
			{post.description}
		</p>
	{/if}

	<!-- Tags -->
	{#if post.tags && post.tags.length > 0}
		<div class="flex items-center gap-2 flex-wrap mb-4.5">
			{#each post.tags as tag (tag)}
				<a
					href={`#tag-${tag.replace('#', '')}`}
					class="text-xs font-medium px-3 py-1 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-muted hover:bg-slate-200 dark:hover:bg-dark-hover hover:text-slate-900 dark:hover:text-dark-text transition-colors no-underline"
				>
					{tag}
				</a>
			{/each}
		</div>
	{/if}

	<!-- Action Bar (Likes, Comments, Repost, Bookmark, Share) -->
	<div
		class="action-bar flex items-center justify-between py-2 border-t border-slate-100 dark:border-dark-border text-slate-600 dark:text-dark-muted text-xs font-medium"
	>
		<!-- Left: Like, Comment, Repost -->
		<div class="flex items-center gap-4 sm:gap-5">
			<button
				type="button"
				class="flex items-center gap-1.5 transition-colors cursor-pointer border-0 bg-transparent p-0 {isLiked
					? 'text-rose-500 font-semibold'
					: 'hover:text-slate-900 dark:hover:text-dark-text'}"
				onclick={toggleLike}
				aria-label="Like post"
			>
				<Icon name="heart" class="text-base {isLiked ? 'text-rose-500' : ''}" />
				<span>{likesCount}</span>
			</button>

			<button
				type="button"
				class="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-dark-text transition-colors cursor-pointer border-0 bg-transparent p-0"
				aria-label="Comments"
			>
				<Icon name="comment" class="text-base" />
				<span>{post.commentsCount}</span>
			</button>

			<button
				type="button"
				class="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-dark-text transition-colors cursor-pointer border-0 bg-transparent p-0"
				aria-label="Repost"
			>
				<Icon name="arrows-repeat" class="text-base" />
				<span>{post.repostsCount}</span>
			</button>
		</div>

		<!-- Right: Bookmark, Share -->
		<div class="flex items-center gap-3">
			<button
				type="button"
				class="p-1 text-slate-500 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text transition-colors cursor-pointer border-0 bg-transparent {isSaved
					? 'text-blue-600 dark:text-kizuna-blue'
					: ''}"
				onclick={toggleSave}
				aria-label={isSaved ? 'Remove bookmark' : 'Save bookmark'}
			>
				<Icon name="bookmark" class="text-base" />
			</button>

			<button
				type="button"
				class="p-1 text-slate-500 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text transition-colors cursor-pointer border-0 bg-transparent"
				aria-label="Share post"
			>
				<Icon name="share" class="text-base" />
			</button>
		</div>
	</div>

	<!-- Comment Preview -->
	{#if post.commentPreview}
		<div
			class="comment-preview mt-3 p-3 rounded-xl bg-slate-50 dark:bg-dark-elevated text-xs leading-normal flex items-center justify-between gap-3 text-slate-700 dark:text-dark-muted"
		>
			<p class="m-0 truncate">
				<strong class="font-semibold text-slate-900 dark:text-dark-text">
					{post.commentPreview.author}
				</strong>
				<span class="ml-2">{post.commentPreview.content}</span>
			</p>
			<button
				type="button"
				class="reply-link text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-dark-muted dark:hover:text-dark-text cursor-pointer border-0 bg-transparent shrink-0"
			>
				Reply
			</button>
		</div>
	{/if}
</article>
