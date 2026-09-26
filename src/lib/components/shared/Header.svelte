<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import Icon from './Icon.svelte';
	import Avatar from './Avatar.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import { authClient } from '$lib/auth-client';
	import { toast } from '$lib/utils/toast.svelte';

	interface Props {
		searchQuery?: string;
		onSearch?: (query: string) => void;
		class?: string;
	}

	let { searchQuery = $bindable(''), onSearch, class: className = '' }: Props = $props();

	const session = authClient.useSession();

	let currentUser = $derived({
		name: $session.data?.user?.name || '',
		handle: $session.data?.user?.email ? `@${$session.data.user.email.split('@')[0]}` : '',
		image: $session.data?.user?.image || null
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

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		searchQuery = target.value;
		onSearch?.(target.value);
	}

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
			<div class="relative flex items-center w-full">
				<Icon
					name="search"
					class="absolute left-3.5 text-slate-500 dark:text-dark-subtle text-sm pointer-events-none"
				/>
				<input
					type="search"
					value={searchQuery}
					oninput={handleInput}
					placeholder="Search creators, exhibitions, visuals..."
					aria-label="Search creators, exhibitions, visuals"
					class="w-full h-10 pl-10 pr-4 text-sm bg-slate-100/85 dark:bg-dark-elevated text-slate-900 dark:text-dark-text placeholder:text-slate-500 dark:placeholder:text-dark-subtle rounded-full border-0 focus:outline-none focus:ring-1.5 focus:ring-slate-900 dark:focus:ring-white transition-all duration-150"
				/>
			</div>
		</div>

		<!-- Right: Actions & User Info -->
		<div class="flex items-center gap-0 sm:gap-2.5 shrink-0">
			<button
				type="button"
				class="sm:hidden {iconButton}"
				aria-label="Search"
				onclick={() => toast.show('Search is coming soon')}
			>
				<Icon name="search" class="text-xl" />
			</button>

			<button
				type="button"
				class={iconButton}
				aria-label="Direct messages"
				title="Direct messages"
				onclick={() => toast.show('Messages are coming soon')}
			>
				<Icon name="paper-plane" class="text-xl sm:text-base" />
			</button>

			<button
				type="button"
				class="hidden sm:flex {iconButton}"
				aria-label="Notifications"
				title="Notifications"
				onclick={() => toast.show('Notifications are coming soon')}
			>
				<Icon name="bell" class="text-base" />
			</button>

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
					<Avatar
						src={currentUser.image || asset('/brand/logo-64.png')}
						name={currentUser.name}
						size="sm"
					/>
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
