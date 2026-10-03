<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { m } from '$lib/i18n';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	let tabs = $derived([
		{ href: resolve('/admin/reports'), label: m.moderation_reports() },
		...(data.isAdmin
			? [{ href: resolve('/admin/moderators'), label: m.moderation_moderators() }]
			: [])
	]);
</script>

<main class="w-full max-w-2xl mx-auto px-4 py-6 sm:py-10 flex flex-col gap-6">
	<div class="flex flex-col gap-3">
		<h1 class="text-2xl font-bold m-0">{m.settings_moderation()}</h1>
		{#if tabs.length > 1}
			<nav aria-label={m.settings_moderation()} class="flex gap-2">
				{#each tabs as tab (tab.href)}
					<a
						href={tab.href}
						aria-current={page.url.pathname === tab.href ? 'page' : undefined}
						class="h-9 px-4 inline-flex items-center rounded-full text-xs font-semibold no-underline bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-text aria-[current=page]:bg-slate-950 aria-[current=page]:text-white dark:aria-[current=page]:bg-white dark:aria-[current=page]:text-slate-950"
					>
						{tab.label}
					</a>
				{/each}
			</nav>
		{/if}
	</div>
	{@render children()}
</main>
