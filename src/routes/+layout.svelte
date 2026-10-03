<script lang="ts">
	import '../app.css';
	import { asset } from '$app/paths';
	import { page } from '$app/state';
	import Header from '$lib/components/shared/Header.svelte';
	import MobileNav from '$lib/components/shared/MobileNav.svelte';
	import NavigationProgress from '$lib/components/shared/NavigationProgress.svelte';
	import Toast from '$lib/components/shared/Toast.svelte';
	import CookieNotice from '$lib/components/shared/CookieNotice.svelte';

	let { children } = $props();

	let isAuthPage = $derived(
		page.url.pathname === '/login' ||
			page.url.pathname === '/signup' ||
			page.url.pathname === '/forgot-password' ||
			page.url.pathname === '/reset-password' ||
			page.url.pathname.startsWith('/auth')
	);
</script>

<svelte:head>
	<link rel="icon" type="image/png" sizes="64x64" href={asset('/brand/logo-64.png')} />
	<link rel="apple-touch-icon" href={asset('/brand/apple-touch-icon.png')} />
</svelte:head>

<NavigationProgress />

<div
	class="min-h-dvh flex flex-col bg-slate-50 dark:bg-dark-canvas text-slate-900 dark:text-dark-text transition-colors duration-200"
>
	{#if !isAuthPage}
		<Header />
	{/if}

	<div class="flex-1 flex flex-col {isAuthPage ? '' : 'pb-nav lg:pb-0'}">
		{@render children()}
	</div>

	{#if !isAuthPage}
		<MobileNav />
	{/if}

	<Toast />
	<CookieNotice />
</div>
