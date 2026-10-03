<script lang="ts">
	import { m } from '$lib/i18n';

	/** Loads the next page when scrolled near, with a retry button if a page fails. */
	let { onLoad, loading, error }: { onLoad: () => void; loading: boolean; error: string | null } =
		$props();

	let sentinel = $state<HTMLDivElement | null>(null);

	// Recreated after every load: a new observer reports the current intersection at once, so a
	// sentinel still in view after a short page keeps loading (the old one would stay silent).
	$effect(() => {
		if (!sentinel || error || loading) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) onLoad();
			},
			{ rootMargin: '400px 0px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});
</script>

{#if error}
	<div class="py-6 flex flex-col items-center gap-2 text-center" role="alert">
		<p class="text-sm text-slate-600 dark:text-slate-300 m-0">{error}</p>
		<button
			type="button"
			class="text-xs font-medium underline text-slate-800 dark:text-slate-200 bg-transparent border-0 cursor-pointer"
			onclick={onLoad}>{m.common_try_again()}</button
		>
	</div>
{:else}
	<div bind:this={sentinel} class="h-8 w-full" aria-hidden="true"></div>
	{#if loading}
		<p class="text-center text-xs text-slate-500 dark:text-dark-muted m-0" aria-live="polite">
			{m.common_loading()}
		</p>
	{/if}
{/if}
