<script lang="ts">
	import '../app.css';
	import '@flaticon/flaticon-uicons/css/regular/all.css';
	import '@flaticon/flaticon-uicons/css/solid/rounded.css';
	import { asset } from '$app/paths';
	import { page } from '$app/state';
	import Header from '$lib/components/shared/Header.svelte';
	import MobileNav from '$lib/components/shared/MobileNav.svelte';
	import Toast from '$lib/components/shared/Toast.svelte';

	let { children } = $props();

	let isAuthPage = $derived(
		page.url.pathname === '/login' ||
			page.url.pathname === '/signup' ||
			page.url.pathname.startsWith('/auth')
	);
</script>

<svelte:head>
	<link rel="icon" type="image/png" sizes="64x64" href={asset('/brand/logo-64.png')} />
	<link rel="apple-touch-icon" href={asset('/brand/apple-touch-icon.png')} />
</svelte:head>

<div
	class="min-h-dvh flex flex-col bg-slate-50 dark:bg-dark-canvas text-slate-900 dark:text-dark-text transition-colors duration-200"
>
	{#if !isAuthPage}
		<Header />
	{/if}

	<div class="flex-1 flex flex-col {isAuthPage ? '' : 'pb-nav md:pb-0'}">
		{@render children()}
	</div>

	{#if !isAuthPage}
		<MobileNav />
	{/if}

	<Toast />
</div>
