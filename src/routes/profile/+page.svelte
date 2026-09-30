<script lang="ts">
	import ProfileHeader from '$lib/components/profile/ProfileHeader.svelte';
	import ProfileTabs from '$lib/components/profile/ProfileTabs.svelte';
	import ProfileGrid from '$lib/components/profile/ProfileGrid.svelte';
	import type { GridItem } from '$lib/components/profile/ProfileGrid.svelte';
	import type { TabId, ViewMode } from '$lib/components/profile/ProfileTabs.svelte';
	import { authClient } from '$lib/auth-client';
	import { profileStore, resolveProfile } from '$lib/utils/profile.svelte';
	import type { PageData } from './$types';

	interface Props {
		data?: PageData;
	}

	let { data }: Props = $props();

	let activeTab = $state<TabId>('grid');
	let viewMode = $state<ViewMode>('grid');

	const session = authClient.useSession();

	$effect(() => {
		profileStore.init();
		const userId =
			($session.data?.user as { id?: string } | undefined)?.id ??
			(data?.user as { id?: string } | undefined)?.id;
		if (userId) {
			profileStore.fetchUser(userId);
		}
	});

	const currentProfile = $derived.by(() => {
		const sessionUser = ($session.data?.user ?? data?.user) as Record<string, unknown> | undefined;
		return resolveProfile(sessionUser, profileStore.updated);
	});

	// In Kizuna, a user's profile displays their actual collections and posts (empty for new accounts)
	const userPosts = $derived<GridItem[]>(data?.posts ?? []);

	const pageTitle = $derived(
		currentProfile.name
			? `${currentProfile.name} (@${currentProfile.handle}) — Kizuna`
			: 'Profile — Kizuna'
	);
	const metaDescription = $derived(
		currentProfile.bio || `${currentProfile.name}'s profile on Kizuna.`
	);
	const ogImage = $derived(
		userPosts.find((p) => Boolean(p.image))?.image || currentProfile.avatar || ''
	);
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={metaDescription} />
	<meta property="og:site_name" content="Kizuna" />
	<meta property="og:type" content="profile" />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={metaDescription} />
	{#if ogImage}
		<meta property="og:image" content={ogImage} />
		<meta property="og:image:secure_url" content={ogImage} />
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
		<!-- Profile Header (Responsive: Mobile Profile Bar / Desktop Master Curator Card) -->
		<ProfileHeader user={data?.user} profile={data?.stats} />

		<!-- Tabs Bar (Responsive: Mobile Icon Tabs / Desktop Filter Pills) -->
		<ProfileTabs bind:activeTab bind:viewMode showSaved />

		<!-- Curated Grid Gallery / List / Essays -->
		<ProfileGrid
			{activeTab}
			savedPosts={data?.saved ?? []}
			{viewMode}
			items={userPosts}
			user={{
				name: currentProfile.name,
				handle: currentProfile.handle,
				image: currentProfile.avatar
			}}
		/>
	</div>
</main>
