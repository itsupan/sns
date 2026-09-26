<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from './Icon.svelte';
	import { navItems, activeNavId, OPEN_COMPOSER_EVENT, type NavItem } from './nav-items';
	import { toast } from '$lib/utils/toast.svelte';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	const tabIds = ['home', 'explore', 'create', 'activity', 'profile'];
	const tabs = navItems.filter((item) => tabIds.includes(item.id));

	let currentActive = $derived(activeNavId(page.url.pathname));

	async function handleTab(event: MouseEvent, item: NavItem) {
		if (item.id === 'create') {
			event.preventDefault();
			if (page.url.pathname !== '/') await goto(resolve('/'));
			window.dispatchEvent(new CustomEvent(OPEN_COMPOSER_EVENT));
			return;
		}
		if (!item.ready) {
			event.preventDefault();
			toast.show(`${item.label} is coming soon`);
			return;
		}
		// Tapping the active tab scrolls back to the top, like native apps.
		if (item.id === currentActive) {
			event.preventDefault();
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}
</script>

<nav
	class="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-dark-card/95 backdrop-blur-md border-t border-slate-200 dark:border-dark-border pb-safe {className}"
	aria-label="Mobile Navigation"
>
	<ul class="h-14 flex items-stretch list-none m-0 p-0">
		{#each tabs as item (item.id)}
			{@const isActive = currentActive === item.id}
			<li class="flex-1 flex">
				{#if item.id === 'create'}
					<button
						type="button"
						class="flex-1 flex items-center justify-center border-0 bg-transparent cursor-pointer group"
						aria-label="Create post"
						onclick={(e) => handleTab(e, item)}
					>
						<span
							class="size-11 rounded-2xl flex items-center justify-center bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-sm transition-transform duration-150 group-active:scale-90"
						>
							<Icon name="plus" class="text-lg" />
						</span>
					</button>
				{:else}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- hrefs come from resolve() in nav-items.ts -->
					<a
						href={item.href}
						class="flex-1 flex flex-col items-center justify-center gap-0.5 no-underline transition-colors duration-150 active:scale-90 {isActive
							? 'text-slate-950 dark:text-white'
							: 'text-slate-500 dark:text-dark-muted'}"
						aria-current={isActive ? 'page' : undefined}
						onclick={(e) => handleTab(e, item)}
					>
						<Icon name={item.icon} type={isActive ? 'sr' : 'rr'} class="text-[22px]" />
						<span class="text-[11px] leading-none {isActive ? 'font-semibold' : 'font-medium'}">
							{item.label}
						</span>
					</a>
				{/if}
			</li>
		{/each}
	</ul>
</nav>
