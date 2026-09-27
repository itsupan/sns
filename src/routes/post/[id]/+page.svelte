<script lang="ts">
	import { resolve } from '$app/paths';
	import SidebarNav from '$lib/components/shared/SidebarNav.svelte';
	import RightSidebar from '$lib/components/feed/RightSidebar.svelte';
	import PostCard from '$lib/components/feed/PostCard.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let post = $derived(data.post);

	let pageTitle = $derived(
		post.title
			? `${post.title} — ${post.author.name} on Kizuna`
			: `Post by ${post.author.name} on Kizuna`
	);

	let metaDescription = $derived(
		post.description
			? post.description.slice(0, 160)
			: `Curated visual observation by ${post.author.name} on Kizuna.`
	);

	let shareImage = $derived(
		post.mediaItems?.[0]?.url || post.mediaUrl || post.image || post.author.avatar || ''
	);
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={metaDescription} />

	<!-- Open Graph / Facebook / Telegram / WhatsApp / LinkedIn -->
	<meta property="og:site_name" content="Kizuna" />
	<meta property="og:type" content="article" />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:url" content={data.postUrl} />
	<link rel="canonical" href={data.postUrl} />
	{#if shareImage}
		<meta property="og:image" content={shareImage} />
		<meta property="og:image:secure_url" content={shareImage} />
		<meta property="og:image:alt" content={post.title || post.description || pageTitle} />
	{/if}

	<!-- Twitter / X Cards -->
	<meta name="twitter:card" content={shareImage ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={metaDescription} />
	{#if shareImage}
		<meta name="twitter:image" content={shareImage} />
		<meta name="twitter:image:alt" content={post.title || post.description || pageTitle} />
	{/if}
	{#if post.author.handle}
		<meta name="twitter:creator" content={post.author.handle} />
	{/if}
</svelte:head>

<!-- Hidden H1 for accessibility and test suites -->
<h1 class="sr-only">{pageTitle}</h1>

<div
	class="max-w-7xl mx-auto px-0 lg:px-4 xl:px-6 w-full flex justify-center lg:justify-between gap-0 lg:gap-4 xl:gap-8"
>
	<!-- Left Navigation Column (Desktop & Tablet Landscape) -->
	<SidebarNav class="hidden lg:flex" />

	<!-- Center Main Column -->
	<main class="flex-1 max-w-2xl min-w-0 pt-2 pb-8 lg:py-6 mx-auto w-full">
		<!-- Back to Feed Link -->
		<div class="px-4 py-2 sm:px-0 mb-2 flex items-center justify-between">
			<a
				href={resolve('/')}
				class="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-dark-muted dark:hover:text-dark-text transition no-underline group"
			>
				<span
					class="size-6 rounded-full bg-slate-100 dark:bg-dark-elevated flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-dark-border transition"
				>
					<Icon name="arrow-left" class="text-[10px]" />
				</span>
				<span>Back to feed</span>
			</a>
			<span class="text-xs text-slate-400 dark:text-dark-muted">Kizuna Journal</span>
		</div>

		<!-- The Post -->
		<div class="feed-posts flex flex-col">
			<PostCard {post} priority={true} />
		</div>
	</main>

	<!-- Right Sidebar Column (Desktop & Tablet Landscape) -->
	<RightSidebar class="hidden lg:flex" />
</div>
