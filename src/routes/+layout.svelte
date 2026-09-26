<script lang="ts">
	import '../app.css';
	import '@flaticon/flaticon-uicons/css/regular/all.css';
	import { asset } from '$app/paths';
	import { page } from '$app/state';
	import Header from '$lib/components/shared/Header.svelte';
	import MobileNav from '$lib/components/shared/MobileNav.svelte';

	let { children } = $props();

	let isAuthPage = $derived(
		page.url.pathname === '/login' ||
			page.url.pathname === '/signup' ||
			page.url.pathname.startsWith('/auth')
	);
</script>

<svelte:head>
	<link rel="icon" type="image/png" href={asset('/brand/kizuna_logo.png')} />
	<link rel="apple-touch-icon" href={asset('/brand/kizuna_logo.png')} />
</svelte:head>

<div
	class="min-h-screen flex flex-col bg-[#fafafa] dark:bg-dark-canvas text-slate-900 dark:text-dark-text transition-colors duration-200"
>
	{#if !isAuthPage}
		<Header />
	{/if}

	<div class="flex-1 flex flex-col pb-16 md:pb-0">
		{@render children()}
	</div>

	{#if !isAuthPage}
		<MobileNav />
	{/if}
</div>
