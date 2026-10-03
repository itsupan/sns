<script lang="ts">
	import { navigating } from '$app/state';

	/** Navigations that finish sooner than this never show the bar, so fast ones don't flicker. */
	const SHOW_AFTER_MS = 150;

	let visible = $state(false);

	$effect(() => {
		if (!navigating.to) {
			visible = false;
			return;
		}
		const timer = setTimeout(() => (visible = true), SHOW_AFTER_MS);
		return () => clearTimeout(timer);
	});
</script>

{#if visible}
	<div
		class="fixed inset-x-0 top-0 z-60 pt-safe pointer-events-none"
		role="progressbar"
		aria-label="Loading page"
	>
		<div class="bar h-0.5 bg-blue-600 dark:bg-kizuna-blue"></div>
	</div>
{/if}

<style>
	/* The load time is unknown: ease towards the end without reaching it. */
	.bar {
		transform-origin: left;
		animation: progress 10s cubic-bezier(0.1, 0.7, 0.2, 1) forwards;
	}

	@keyframes progress {
		from {
			transform: scaleX(0.1);
		}
		to {
			transform: scaleX(0.95);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bar {
			animation: none;
		}
	}
</style>
