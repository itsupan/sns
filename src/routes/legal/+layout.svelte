<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { LEGAL_LAST_UPDATED } from '$lib/constants/legal';

	let { children } = $props();

	const tabs = [
		{ href: resolve('/legal/terms'), label: 'Terms of Service' },
		{ href: resolve('/legal/privacy'), label: 'Privacy Policy' },
		{ href: resolve('/legal/cookies'), label: 'Cookie Policy' },
		{ href: resolve('/legal/guidelines'), label: 'Community Guidelines' }
	];
</script>

<main class="legal w-full max-w-3xl mx-auto px-4 py-8 sm:py-12">
	<nav aria-label="Legal documents" class="flex flex-wrap gap-2 mb-8">
		{#each tabs as tab (tab.href)}
			{@const active = page.url.pathname === tab.href}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- hrefs come from resolve() above -->
			<a
				href={tab.href}
				aria-current={active ? 'page' : undefined}
				class="text-xs font-medium px-3 py-1.5 rounded-full no-underline transition-colors {active
					? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
					: 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-dark-elevated dark:text-dark-muted dark:hover:bg-dark-hover'}"
			>
				{tab.label}
			</a>
		{/each}
	</nav>

	<article
		class="bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border rounded-2xl p-5 sm:p-8"
	>
		{@render children()}
		<p class="updated">Last updated {LEGAL_LAST_UPDATED}</p>
	</article>
</main>

<style>
	.legal :global(h1) {
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1.2;
		margin: 0 0 0.5rem;
	}
	.legal :global(h2) {
		font-size: 1.125rem;
		font-weight: 700;
		margin: 2rem 0 0.5rem;
	}
	.legal :global(p),
	.legal :global(li) {
		font-size: 0.95rem;
		line-height: 1.7;
	}
	.legal :global(p) {
		margin: 0 0 0.75rem;
	}
	.legal :global(ul) {
		list-style: disc;
		padding-left: 1.25rem;
		margin: 0 0 0.75rem;
	}
	.legal :global(li) {
		margin-bottom: 0.25rem;
	}
	.legal :global(article a) {
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.legal :global(.lede) {
		opacity: 0.75;
	}
	.legal :global(table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
		margin: 0 0 1rem;
	}
	.legal :global(th),
	.legal :global(td) {
		text-align: left;
		padding: 0.5rem;
		border-bottom: 1px solid rgb(148 163 184 / 0.3);
		vertical-align: top;
	}
	.legal :global(.table-wrap) {
		overflow-x: auto;
	}
	.updated {
		margin: 2rem 0 0;
		font-size: 0.8rem;
		opacity: 0.6;
	}
</style>
