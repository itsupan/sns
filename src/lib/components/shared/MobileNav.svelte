<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from './Icon.svelte';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	const navItems = [
		{ id: 'home', label: 'Home', icon: 'home', href: resolve('/') },
		{ id: 'explore', label: 'Explore', icon: 'compass-alt', href: resolve('/#explore') },
		{ id: 'create', label: 'Create', icon: 'plus', href: resolve('/#create') },
		{ id: 'activity', label: 'Activity', icon: 'clock', href: resolve('/#activity') },
		{ id: 'profile', label: 'Profile', icon: 'user', href: resolve('/profile') }
	];

	let currentActive = $derived.by(() => {
		if (page.url.pathname === '/profile') return 'profile';
		if (page.url.pathname === '/' && !page.url.hash) return 'home';
		return page.url.hash.replace('#', '') || 'home';
	});
</script>

<nav
	class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-dark-card/95 backdrop-blur-md border-t border-slate-200 dark:border-dark-border px-3 py-2 flex items-center justify-around {className}"
	aria-label="Mobile Navigation"
>
	{#each navItems as item (item.id)}
		{@const isActive = currentActive === item.id}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a
			href={item.href}
			class="flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-150 no-underline {isActive
				? 'text-slate-950 dark:text-white font-semibold'
				: 'text-slate-500 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text'}"
			aria-current={isActive ? 'page' : undefined}
		>
			<Icon name={item.icon} class="text-xl" />
			<span class="text-[10px] tracking-tight">{item.label}</span>
		</a>
	{/each}
</nav>
