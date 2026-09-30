<script lang="ts">
	import ProfileHeader from '$lib/components/profile/ProfileHeader.svelte';
	import ProfileTabs from '$lib/components/profile/ProfileTabs.svelte';
	import ProfileGrid from '$lib/components/profile/ProfileGrid.svelte';
	import type { GridItem } from '$lib/components/profile/ProfileGrid.svelte';
	import type { TabId, ViewMode } from '$lib/components/profile/ProfileTabs.svelte';
	import { resolveProfile } from '$lib/utils/profile.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let activeTab = $state<TabId>('grid');
	let viewMode = $state<ViewMode>('grid');
	// SvelteKit reuses this component between profiles; start each one on the default tab.
	$effect.pre(() => {
		void data.targetUser.id;
		activeTab = 'grid';
		viewMode = 'grid';
	});

	const currentProfile = $derived.by(() => {
		return resolveProfile(data.targetUser, null, {
			isOwnProfile: data.isOwnProfile
		});
	});

	const userPosts = $derived<GridItem[]>(data.posts ?? []);

	const pageTitle = $derived(
		currentProfile.name
			? `${currentProfile.name} (@${currentProfile.handle}) — Kizuna`
			: 'Curator Profile — Kizuna'
	);
	const metaDescription = $derived(
		currentProfile.bio || `${currentProfile.name}'s photography and curation profile on Kizuna.`
	);
	function toAbsoluteUrl(pathOrUrl: string | undefined | null, origin: string): string {
		if (!pathOrUrl) return '';
		if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
			return pathOrUrl;
		}
		const clean = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
		return `${origin}${clean}`;
	}

	function isVideoUrl(url: string): boolean {
		return /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
	}

	function getImageType(url: string): string {
		if (/\.png(\?.*)?$/i.test(url)) return 'image/png';
		if (/\.webp(\?.*)?$/i.test(url)) return 'image/webp';
		if (/\.gif(\?.*)?$/i.test(url)) return 'image/gif';
		return 'image/jpeg';
	}

	const rawOgImage = $derived(
		userPosts.find((p) => Boolean(p.image) && !isVideoUrl(p.image))?.image ||
			(currentProfile.avatar && !isVideoUrl(currentProfile.avatar) ? currentProfile.avatar : '') ||
			'/brand/icon-512.png'
	);

	const ogImage = $derived(toAbsoluteUrl(rawOgImage, data.origin || ''));
	const ogImageType = $derived(getImageType(ogImage));
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={metaDescription} />
	<meta property="og:site_name" content="Kizuna" />
	<meta property="og:type" content="profile" />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={metaDescription} />
	{#if data.canonicalUrl}
		<meta property="og:url" content={data.canonicalUrl} />
		<link rel="canonical" href={data.canonicalUrl} />
	{/if}
	{#if ogImage}
		<meta property="og:image" content={ogImage} />
		<meta property="og:image:secure_url" content={ogImage} />
		<meta property="og:image:type" content={ogImageType} />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
		<meta property="og:image:alt" content={pageTitle} />
		<meta name="twitter:image" content={ogImage} />
		<meta name="twitter:image:alt" content={pageTitle} />
		<meta name="twitter:card" content="summary_large_image" />
	{:else}
		<meta name="twitter:card" content="summary" />
	{/if}
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={metaDescription} />
</svelte:head>

<main class="w-full flex-1 flex flex-col items-center">
	<div class="w-full max-w-6xl mx-auto px-0 sm:px-6 lg:px-8 py-0 sm:py-6 flex flex-col">
		<!-- Profile Header (Supports both own profile and other user view) -->
		<ProfileHeader
			user={data.targetUser}
			profile={{
				...data.stats,
				isOwnProfile: data.isOwnProfile
			}}
		/>

		<!-- Tabs Bar -->
		<ProfileTabs bind:activeTab bind:viewMode showSaved={data.isOwnProfile} />

		<!-- Curated Grid Gallery / List / Essays -->
		<ProfileGrid
			{activeTab}
			savedPosts={data.saved}
			{viewMode}
			items={userPosts}
			user={{
				name: currentProfile.name,
				handle: currentProfile.handle,
				image: currentProfile.avatar
			}}
			isOwnProfile={data.isOwnProfile}
		/>
	</div>
</main>
