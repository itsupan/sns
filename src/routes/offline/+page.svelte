<script lang="ts">
	import Icon from '$lib/components/shared/Icon.svelte';
</script>

<svelte:head>
	<title>Offline · Kizuna</title>
</svelte:head>

<main class="w-full flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-20">
	<div
		class="w-full max-w-lg bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-3xl p-6 sm:p-10 shadow-sm dark:shadow-none text-center flex flex-col items-center"
	>
		<div
			class="size-16 sm:size-20 rounded-2xl sm:rounded-3xl bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-text flex items-center justify-center mb-6 shadow-xs"
		>
			<Icon name="exclamation" class="text-2xl sm:text-3xl" />
		</div>
		<h1 class="text-2xl font-bold text-slate-950 dark:text-white m-0 mb-2">You're offline</h1>
		<p class="text-sm leading-relaxed text-slate-600 dark:text-dark-muted max-w-md m-0 mb-8">
			Kizuna needs a connection to load this page. Check your network and try again.
		</p>
		<button
			type="button"
			onclick={() => location.reload()}
			class="h-11 px-6 rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-950 font-semibold text-xs inline-flex items-center justify-center hover:opacity-90 active:scale-95 transition-all border-0 cursor-pointer shadow-xs"
		>
			Try again
		</button>
	</div>
</main>
