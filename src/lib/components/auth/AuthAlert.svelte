<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/shared/Icon.svelte';

	interface Props {
		type: 'error' | 'success';
		children: Snippet;
	}

	let { type, children }: Props = $props();
</script>

{#if type === 'error'}
	<div
		class="alert alert-error flex items-center gap-2.5 p-3 rounded-[10px] text-[13px] mb-4.5 leading-snug bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60"
		role="alert"
	>
		<Icon name="cross-circle" class="alert-icon text-base shrink-0" />
		<span>{@render children()}</span>
	</div>
{:else}
	<div
		class="alert alert-success flex items-center gap-2.5 p-3 rounded-[10px] text-[13px] mb-4.5 leading-snug bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60"
		role="status"
	>
		<Icon name="check-circle" class="alert-icon text-base shrink-0" />
		<span>{@render children()}</span>
	</div>
{/if}
