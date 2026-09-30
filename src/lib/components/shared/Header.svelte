<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import Icon from './Icon.svelte';
	import Avatar from './Avatar.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import SearchBox from './SearchBox.svelte';
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import { badges } from '$lib/utils/badges.svelte';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	/** Full-screen search on phones, where the header has no room for the input. */
	let mobileSearchOpen = $state(false);

	const session = authClient.useSession();

	let currentUser = $derived({
		name: $session.data?.user?.name || '',
		handle: $session.data?.user?.email ? `@${$session.data.user.email.split('@')[0]}` : '',
		image: $session.data?.user?.image || null
	});

	/** Unread messages and activity, refreshed on navigation and when the tab becomes visible. */
	let signedIn = $derived(!!$session.data?.user);
	let unread = $derived(badges.messages);
	let unreadActivity = $derived(badges.activity);

	$effect(() => {
		// Re-run on every navigation (e.g. after reading a conversation or opening Activity).
		void page.url.pathname;
		if (!signedIn) {
			badges.clear();
			return;
		}
		untrack(() => badges.refresh());
		const onVisible = () => document.visibilityState === 'visible' && badges.refresh();
		document.addEventListener('visibilitychange', onVisible);
		return () => document.removeEventListener('visibilitychange', onVisible);
	});

	// Mobile app-bar behaviour: slide away while scrolling down, reappear on scroll up.
	let hidden = $state(false);

	$effect(() => {
		let lastY = window.scrollY;
		let ticking = false;

		function update() {
			const y = window.scrollY;
			const delta = y - lastY;
			if (y < 64) hidden = false;
			else if (delta > 6) hidden = true;
			else if (delta < -6) hidden = false;
			lastY = y;
			ticking = false;
		}

		function onScroll() {
			if (!ticking) {
				ticking = true;
				requestAnimationFrame(update);
			}
		}

		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	const iconButton =
		'size-11 sm:size-9 rounded-full flex items-center justify-center text-slate-700 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text hover:bg-slate-100 dark:hover:bg-dark-hover active:scale-95 active:bg-slate-100 dark:active:bg-dark-hover transition duration-150 cursor-pointer border-0 bg-transparent';
</script>

<header
	class="sticky top-0 z-40 w-full pt-safe border-b border-slate-200/80 dark:border-dark-border bg-white/90 dark:bg-dark-card/95 backdrop-blur-md transition-[transform,background-color] duration-200 md:translate-y-0 {hidden
		? '-translate-y-full'
		: 'translate-y-0'} {className}"
>
	<div
		class="max-w-7xl mx-auto pl-4 pr-1.5 sm:px-6 h-13 sm:h-16 flex items-center justify-between gap-2 sm:gap-4"
	>
		<!-- Left: Brand -->
		<a
			href={resolve('/')}
			class="flex items-center gap-2 sm:gap-2.5 shrink-0 no-underline group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 dark:focus-visible:outline-kizuna-blue rounded-lg"
		>
			<img
				src={asset('/brand/logo-64.png')}
				alt=""
				width="32"
				height="32"
				class="size-7 sm:size-8 rounded-full object-cover shrink-0 shadow-xs border border-black/10 dark:border-dark-border group-hover:scale-105 transition-transform duration-150"
			/>
			<span class="brand-title font-bold text-lg tracking-tight text-slate-950 dark:text-dark-text">
				Kizuna
			</span>
		</a>

		<!-- Center: Search Bar (Tablet / Desktop) -->
		<div class="hidden sm:flex flex-1 max-w-xl mx-2 sm:mx-6">
			<SearchBox />
		</div>

		<!-- Right: Actions & User Info -->
		<div class="flex items-center gap-0 sm:gap-2.5 shrink-0">
			<button
				type="button"
				class="sm:hidden {iconButton}"
				aria-label="Search"
				aria-haspopup="dialog"
				onclick={() => (mobileSearchOpen = true)}
			>
				<Icon name="search" class="text-xl" />
			</button>

			<a
				href={resolve('/messages')}
				class="relative {iconButton}"
				aria-label={unread > 0 ? `Direct messages, ${unread} unread` : 'Direct messages'}
				title="Direct messages"
			>
				<Icon name="beacon" class="text-xl sm:text-base" />
				{#if unread > 0}
					<span
						class="absolute top-1.5 right-1.5 sm:top-0 sm:right-0 min-w-4 h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold leading-4 text-center"
						aria-hidden="true">{unread > 99 ? '99+' : unread}</span
					>
				{/if}
			</a>

			<a
				href={resolve('/activity')}
				class="hidden sm:flex relative {iconButton}"
				aria-label={unreadActivity > 0 ? `Activity, ${unreadActivity} new` : 'Activity'}
				title="Activity"
			>
				<Icon name="bell" class="text-base" />
				{#if unreadActivity > 0}
					<span
						class="absolute top-0 right-0 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold leading-4 text-center"
						aria-hidden="true">{unreadActivity > 99 ? '99+' : unreadActivity}</span
					>
				{/if}
			</a>

			<!-- Theme toggle lives in Profile settings on mobile to keep the app bar clean -->
			<div class="hidden sm:block">
				<ThemeToggle />
			</div>

			<div class="h-6 w-px bg-slate-200 dark:bg-dark-border mx-1 hidden sm:block"></div>

			{#if $session.data?.user}
				<a
					href={resolve('/profile')}
					class="hidden sm:flex items-center gap-2.5 pl-1 pr-1.5 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors duration-150 no-underline text-inherit"
				>
					<Avatar src={currentUser.image} name={currentUser.name} size="sm" />
					<div class="hidden md:flex flex-col text-left">
						<span class="text-xs font-semibold text-slate-900 dark:text-dark-text leading-tight">
							{currentUser.name}
						</span>
						<span class="text-[11px] text-slate-500 dark:text-dark-muted leading-tight">
							{currentUser.handle}
						</span>
					</div>
				</a>
			{:else}
				<a
					href={resolve('/login')}
					class="hidden sm:inline-flex items-center h-9 px-4 rounded-full text-xs font-semibold bg-slate-950 text-white dark:bg-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors duration-150 no-underline"
				>
					Log in
				</a>
			{/if}
		</div>
	</div>
</header>

{#if mobileSearchOpen}
	<div
		class="sm:hidden fixed inset-0 z-[60] bg-white dark:bg-dark-card pt-safe flex flex-col"
		role="dialog"
		aria-modal="true"
		aria-label="Search"
	>
		<div
			class="flex items-center gap-2 px-2 h-14 border-b border-slate-200/80 dark:border-dark-border"
		>
			<button
				type="button"
				class={iconButton}
				aria-label="Close search"
				onclick={() => (mobileSearchOpen = false)}
			>
				<Icon name="angle-left" class="text-xl" />
			</button>
			<SearchBox autofocus onNavigate={() => (mobileSearchOpen = false)} class="flex-1" />
		</div>
	</div>
{/if}

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && mobileSearchOpen) mobileSearchOpen = false;
	}}
/>
