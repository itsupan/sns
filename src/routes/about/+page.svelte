<script lang="ts">
	import { resolve } from '$app/paths';
	import { CONTACT_EMAIL, LEGAL_LINKS } from '$lib/constants/legal';
	import { m } from '$lib/i18n';
</script>

<svelte:head><title>{m.about_title()}</title></svelte:head>

<main class="w-full max-w-2xl mx-auto px-4 py-10 sm:py-14 flex flex-col gap-6">
	<header class="flex flex-col gap-2">
		<p
			class="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-dark-subtle m-0"
		>
			{m.legal_about_label()}
		</p>
		<h1 class="text-3xl font-bold m-0">Kizuna</h1>
		<p class="text-slate-600 dark:text-dark-muted leading-relaxed m-0">
			{m.about_intro()}
		</p>
	</header>

	<section
		class="bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border rounded-2xl p-5 flex flex-col gap-2"
	>
		<h2 class="text-base font-bold m-0">{m.about_contact()}</h2>
		<p class="text-sm text-slate-600 dark:text-dark-muted m-0">
			{m.about_contact_text()}
			<span class="font-medium text-slate-900 dark:text-dark-text select-all">{CONTACT_EMAIL}</span>
		</p>
	</section>

	<nav aria-label={m.nav_legal()} class="flex flex-wrap gap-x-4 gap-y-2 text-sm">
		{#each LEGAL_LINKS.filter((l) => l.href !== '/about') as link (link.href)}
			<a
				href={resolve(link.href)}
				class="text-slate-600 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text underline underline-offset-2"
				>{link.label}</a
			>
		{/each}
	</nav>
</main>
