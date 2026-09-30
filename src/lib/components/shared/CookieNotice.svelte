<script lang="ts" module>
	export const COOKIE_NOTICE_KEY = 'kizuna-cookie-notice';
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';

	// Hidden until mounted, so server-rendered pages never flash the notice for people who closed it.
	let visible = $state(false);

	onMount(() => {
		try {
			visible = localStorage.getItem(COOKIE_NOTICE_KEY) !== 'dismissed';
		} catch {
			// Storage blocked (private mode, site data disabled): show it; dismissing then lasts for this page view.
			visible = true;
		}
	});

	function dismiss() {
		visible = false;
		try {
			localStorage.setItem(COOKIE_NOTICE_KEY, 'dismissed');
		} catch {
			// Ignore: see above.
		}
	}
</script>

{#if visible}
	<div
		role="region"
		aria-label="Cookie notice"
		class="fixed inset-x-3 z-50 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-sm flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-dark-border bg-white/95 dark:bg-dark-card/95 backdrop-blur-md px-4 py-3 shadow-lg text-[13px] text-slate-600 dark:text-dark-muted"
	>
		<p class="m-0 flex-1 leading-snug">
			Kizuna uses only essential cookies to keep you signed in.
			<a
				href={resolve('/legal/cookies')}
				class="underline underline-offset-2 text-slate-900 dark:text-dark-text">Cookie Policy</a
			>
		</p>
		<button
			type="button"
			class="shrink-0 rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-950 px-4 py-1.5 text-xs font-semibold cursor-pointer border-0"
			onclick={dismiss}
		>
			OK
		</button>
	</div>
{/if}
