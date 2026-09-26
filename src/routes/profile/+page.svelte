<script lang="ts">
	import ProfileHeader from '$lib/components/profile/ProfileHeader.svelte';
	import ProfileHighlights from '$lib/components/profile/ProfileHighlights.svelte';
	import ProfileTabs from '$lib/components/profile/ProfileTabs.svelte';
	import ProfileGrid from '$lib/components/profile/ProfileGrid.svelte';
	import type { TabId, ViewMode } from '$lib/components/profile/ProfileTabs.svelte';

	let activeTab = $state<TabId>('grid');
	let viewMode = $state<ViewMode>('grid');
</script>

<svelte:head>
	<title>Elena Rostova (@elena.rostova) — Kizuna</title>
	<meta
		name="description"
		content="Architectural & Film Photographer capturing silence, light, and brutalist geometries across Scandinavia & Japan."
	/>
</svelte:head>

<main class="w-full flex-1 flex flex-col items-center">
	<div class="w-full max-w-6xl mx-auto px-0 sm:px-6 lg:px-8 py-0 sm:py-6 flex flex-col">
		<!-- Profile Header (Responsive: Mobile Profile Bar / Desktop Master Curator Card) -->
		<ProfileHeader />

		<!-- Story Collections / Highlights -->
		<ProfileHighlights />

		<!-- Tabs Bar (Responsive: Mobile Icon Tabs / Desktop Filter Pills) -->
		<ProfileTabs bind:activeTab bind:viewMode />

		<!-- Curated Grid Gallery / List / Essays -->
		<ProfileGrid {activeTab} {viewMode} />
	</div>
</main>
