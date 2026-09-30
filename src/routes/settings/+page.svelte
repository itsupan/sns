<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import { LEGAL_LINKS } from '$lib/constants/legal';
	import Icon from '$lib/components/shared/Icon.svelte';
	import ThemeToggle from '$lib/components/shared/ThemeToggle.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let signingOut = $state(false);

	async function signOut() {
		signingOut = true;
		await authClient.signOut();
		await goto(resolve('/login'));
	}

	const rowClass =
		'flex items-center justify-between gap-4 min-h-12 px-4 py-2 text-[15px] text-slate-900 dark:text-dark-text no-underline';
	const cardClass =
		'bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border rounded-2xl divide-y divide-slate-100 dark:divide-dark-border overflow-hidden';
	const headingClass =
		'px-1 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-dark-subtle';
</script>

<svelte:head><title>Settings · Kizuna</title></svelte:head>

<main class="w-full max-w-2xl mx-auto px-4 py-6 sm:py-10 flex flex-col gap-6">
	<h1 class="text-2xl font-bold m-0">Settings</h1>

	<section aria-labelledby="settings-account">
		<h2 id="settings-account" class={headingClass}>Account</h2>
		<div class={cardClass}>
			<div class={rowClass}>
				<span>Email</span>
				<span class="text-sm text-slate-500 dark:text-dark-muted truncate min-w-0"
					>{data.email}</span
				>
			</div>
			<a
				href={resolve('/profile/edit')}
				class="{rowClass} hover:bg-slate-50 dark:hover:bg-dark-hover"
			>
				<span>Edit profile</span>
				<Icon name="angle-small-right" class="text-slate-400" />
			</a>
			<div class={rowClass}>
				<span>Appearance</span>
				<ThemeToggle variant="segmented" />
			</div>
		</div>
	</section>

	<section aria-labelledby="settings-legal">
		<h2 id="settings-legal" class={headingClass}>About & legal</h2>
		<div class={cardClass}>
			{#each LEGAL_LINKS as link (link.href)}
				<a href={resolve(link.href)} class="{rowClass} hover:bg-slate-50 dark:hover:bg-dark-hover">
					<span>{link.title}</span>
					<Icon name="angle-small-right" class="text-slate-400" />
				</a>
			{/each}
		</div>
	</section>

	<button
		type="button"
		class="self-start inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/60 border-0 cursor-pointer disabled:opacity-60"
		onclick={signOut}
		disabled={signingOut}
	>
		<Icon name="sign-out-alt" />
		Log out
	</button>
</main>
