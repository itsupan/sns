<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from './Icon.svelte';

	interface Props {
		activeItem?: string;
		class?: string;
	}

	let { activeItem = 'home', class: className = '' }: Props = $props();

	const navItems = [
		{ id: 'home', label: 'Home', icon: 'home', href: resolve('/') },
		{ id: 'explore', label: 'Explore', icon: 'compass-alt', href: resolve('/#explore') },
		{ id: 'create', label: 'Create', icon: 'plus', href: resolve('/#create') },
		{ id: 'activity', label: 'Activity', icon: 'clock', href: resolve('/#activity') },
		{ id: 'saved', label: 'Saved / Collections', icon: 'bookmark', href: resolve('/#saved') },
		{ id: 'profile', label: 'Profile', icon: 'user', href: resolve('/profile') }
	];

	let currentActive = $derived.by(() => {
		if (page.url.pathname === '/profile') return 'profile';
		if (page.url.pathname === '/' && !page.url.hash) return 'home';
		return page.url.hash.replace('#', '') || activeItem;
	});
</script>

<aside
	class="w-56 lg:w-60 shrink-0 hidden md:flex flex-col justify-between py-6 h-[calc(100vh-4rem)] sticky top-16 select-none {className}"
	aria-label="Main Navigation"
>
	<!-- Top Navigation List -->
	<nav class="flex flex-col gap-1.5">
		{#each navItems as item (item.id)}
			{@const isActive = currentActive === item.id}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a
				href={item.href}
				class="flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[14px] font-medium transition-all duration-150 no-underline {isActive
					? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 font-semibold shadow-xs'
					: 'text-slate-700 dark:text-dark-text hover:bg-slate-100 dark:hover:bg-dark-elevated'}"
				aria-current={isActive ? 'page' : undefined}
			>
				<Icon name={item.icon} class="text-[17px] shrink-0" />
				<span>{item.label}</span>
			</a>
		{/each}
	</nav>

	<!-- Bottom Section: Curated Feed status & Preferences -->
	<div class="flex flex-col gap-2 pt-4 border-t border-slate-200/80 dark:border-dark-border">
		<!-- Curated Feed Status -->
		<div
			class="flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-700 dark:text-dark-muted tracking-wider uppercase"
		>
			<div class="flex items-center gap-2">
				<span class="size-2 rounded-full bg-blue-600 animate-pulse"></span>
				<span class="text-[11px] font-bold">Curated Feed</span>
			</div>
			<Icon name="badge-check" class="text-blue-600 dark:text-kizuna-blue text-sm" />
		</div>

		<!-- Preferences Link -->
		<a
			href={resolve('/#preferences')}
			class="flex items-center justify-between px-4 py-2.5 rounded-xl text-[13px] font-medium text-slate-600 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text hover:bg-slate-100 dark:hover:bg-dark-elevated transition-colors duration-150 no-underline"
		>
			<div class="flex items-center gap-3">
				<Icon name="settings" class="text-base shrink-0" />
				<span>Preferences</span>
			</div>
			<Icon name="angle-small-right" class="text-base text-slate-400" />
		</a>
	</div>
</aside>
