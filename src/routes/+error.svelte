<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from '$lib/components/shared/Icon.svelte';

	const status = $derived(page.status && page.status > 0 ? page.status : 404);
	const is404 = $derived(status === 404);
	const pageTitle = $derived(
		is404 ? '404: Page Not Found — Kizuna' : `${status}: Something Went Wrong — Kizuna`
	);
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta
		name="description"
		content={is404
			? 'The requested page could not be found on Kizuna.'
			: 'An error occurred while loading this page.'}
	/>
</svelte:head>

<main class="w-full flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-20">
	<div
		class="w-full max-w-lg bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-3xl p-6 sm:p-10 shadow-sm dark:shadow-none text-center flex flex-col items-center"
	>
		<!-- Visual Badge / Icon -->
		<div
			class="size-16 sm:size-20 rounded-2xl sm:rounded-3xl bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-text flex items-center justify-center mb-6 shadow-xs"
		>
			{#if is404}
				<Icon name="search" class="text-2xl sm:text-3xl" />
			{:else}
				<Icon name="exclamation" class="text-2xl sm:text-3xl text-red-500" />
			{/if}
		</div>

		<!-- Status Code -->
		<div
			class="text-6xl sm:text-7xl font-extrabold tracking-tight text-slate-950 dark:text-white mb-2 select-none"
		>
			{status}
		</div>

		<!-- Status Badge -->
		<span
			class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border {is404
				? 'bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-muted border-slate-200 dark:border-dark-border'
				: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50'}"
		>
			{is404 ? 'Page Not Found · ページが見つかりません' : 'Application Error · エラー'}
		</span>

		<!-- Explanatory message -->
		<p class="text-sm leading-relaxed text-slate-600 dark:text-dark-muted max-w-md mb-8">
			{#if is404}
				The page you are looking for doesn't exist, has been removed, or the link may be mistyped.
			{:else}
				{page.error?.message || 'An unexpected error occurred. Please try again or return home.'}
				{#if page.error?.id}
					<span class="block mt-2 text-xs text-slate-400 dark:text-dark-muted">
						Reference: {page.error.id}
					</span>
				{/if}
			{/if}
		</p>

		<!-- Action Buttons -->
		<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
			<a
				href={resolve('/')}
				class="h-11 px-6 rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-950 font-semibold text-xs inline-flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all no-underline shadow-xs"
			>
				<Icon name="home" class="text-xs" />
				<span>Return to Feed</span>
			</a>

			<a
				href={resolve('/profile')}
				class="h-11 px-6 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text hover:bg-slate-200 dark:hover:bg-dark-hover active:scale-95 font-semibold text-xs inline-flex items-center justify-center gap-2 border border-slate-200 dark:border-dark-border transition-all no-underline shadow-xs"
			>
				<Icon name="user" class="text-xs" />
				<span>Go to Profile</span>
			</a>
		</div>

		<!-- History back link -->
		<button
			type="button"
			onclick={() => history.back()}
			class="mt-6 text-xs text-slate-400 hover:text-slate-700 dark:text-dark-muted dark:hover:text-dark-text underline underline-offset-4 cursor-pointer transition-colors bg-transparent border-0"
		>
			Go back to previous page
		</button>
	</div>
</main>
