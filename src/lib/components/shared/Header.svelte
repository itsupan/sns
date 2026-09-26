<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import Icon from './Icon.svelte';
	import Avatar from './Avatar.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import { authClient } from '$lib/auth-client';

	interface Props {
		searchQuery?: string;
		onSearch?: (query: string) => void;
		class?: string;
	}

	let { searchQuery = $bindable(''), onSearch, class: className = '' }: Props = $props();

	const session = authClient.useSession();

	let currentUser = $derived({
		name: $session.data?.user?.name || 'Julian Vance',
		handle: $session.data?.user?.email ? `@${$session.data.user.email.split('@')[0]}` : '@jvance',
		image: $session.data?.user?.image || null
	});

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		searchQuery = target.value;
		onSearch?.(target.value);
	}
</script>

<header
	class="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-dark-border bg-white/90 dark:bg-dark-card/95 backdrop-blur-md transition-colors duration-200 {className}"
>
	<div
		class="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4"
	>
		<!-- Left: Brand + Journal Badge -->
		<div class="flex items-center gap-2 sm:gap-2.5 shrink-0">
			<a
				href={resolve('/')}
				class="flex items-center gap-2 sm:gap-2.5 no-underline group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 dark:focus-visible:outline-kizuna-blue rounded-lg"
			>
				<img
					src={asset('/brand/kizuna_logo.png')}
					alt="Kizuna logo"
					class="size-7 sm:size-8 rounded-full object-cover shrink-0 shadow-xs border border-black/10 dark:border-dark-border group-hover:scale-105 transition-transform duration-150"
				/>
				<span
					class="brand-title font-bold text-base sm:text-lg tracking-tight text-slate-950 dark:text-dark-text"
				>
					Kizuna
				</span>
			</a>
		</div>

		<!-- Center: Search Bar (Tablet / Desktop) -->
		<div class="hidden sm:flex flex-1 max-w-xl mx-2 sm:mx-6">
			<div class="relative flex items-center w-full">
				<Icon
					name="search"
					class="absolute left-3.5 text-slate-400 dark:text-dark-subtle text-sm pointer-events-none"
				/>
				<input
					type="search"
					value={searchQuery}
					oninput={handleInput}
					placeholder="Search creators, exhibitions, visuals..."
					aria-label="Search creators, exhibitions, visuals"
					class="w-full h-10 pl-10 pr-4 text-sm bg-slate-100/85 dark:bg-dark-elevated text-slate-900 dark:text-dark-text placeholder:text-slate-400 dark:placeholder:text-dark-subtle rounded-full border-0 focus:outline-none focus:ring-1.5 focus:ring-slate-900 dark:focus:ring-white transition-all duration-150"
				/>
			</div>
		</div>

		<!-- Right: Actions & User Info -->
		<div class="flex items-center gap-1 sm:gap-2.5 shrink-0">
			<!-- Mobile Search button -->
			<button
				type="button"
				class="sm:hidden size-9 rounded-full flex items-center justify-center text-slate-600 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors duration-150 cursor-pointer border-0 bg-transparent"
				aria-label="Search"
			>
				<Icon name="search" class="text-base" />
			</button>

			<!-- Chat / Messages button -->
			<button
				type="button"
				class="size-9 rounded-full flex items-center justify-center text-slate-600 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors duration-150 cursor-pointer border-0 bg-transparent"
				aria-label="Direct messages"
				title="Direct messages"
			>
				<Icon name="comment-alt" class="text-base" />
			</button>

			<!-- Notification button with badge -->
			<button
				type="button"
				class="relative size-9 rounded-full flex items-center justify-center text-slate-600 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors duration-150 cursor-pointer border-0 bg-transparent"
				aria-label="Notifications"
				title="Notifications"
			>
				<Icon name="bell" class="text-base" />
				<span
					class="absolute top-2 right-2 size-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-dark-card"
				></span>
			</button>

			<!-- Dark / Light theme toggle -->
			<ThemeToggle />

			<!-- Divider -->
			<div class="h-6 w-px bg-slate-200 dark:bg-dark-border mx-1 hidden sm:block"></div>

			<!-- User Profile Item (Desktop / Tablet) -->
			<a
				href={resolve('/#profile')}
				class="hidden sm:flex items-center gap-2.5 pl-1 pr-1.5 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors duration-150 no-underline text-inherit"
			>
				<Avatar
					src={currentUser.image || asset('/brand/kizuna_logo.png')}
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
		</div>
	</div>
</header>
