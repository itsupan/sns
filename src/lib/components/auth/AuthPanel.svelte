<script lang="ts">
	import type { Snippet } from 'svelte';
	import KizunaLogo from '$lib/components/shared/KizunaLogo.svelte';

	interface Props {
		subtitle?: string;
		children: Snippet;
	}

	let { subtitle, children }: Props = $props();
</script>

<div
	class="auth-card relative w-full max-w-[27.5rem] mx-auto box-border transition-colors duration-200 px-4 py-6 sm:p-9 bg-transparent sm:bg-white dark:sm:bg-dark-card rounded-none sm:rounded-3xl border-0 sm:border border-slate-100 dark:border-dark-border shadow-none sm:shadow-[0_20px_45px_-12px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.03)] dark:sm:shadow-[0_12px_28px_0_rgba(0,0,0,0.35)]"
>
	<KizunaLogo {subtitle} />
	{@render children()}
</div>
