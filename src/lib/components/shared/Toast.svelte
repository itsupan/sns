<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toast } from '$lib/utils/toast.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
</script>

<div
	class="pointer-events-none fixed inset-x-0 z-[100] flex justify-center px-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-8"
	aria-live="polite"
	role="status"
>
	{#if toast.current}
		{#key toast.current.id}
			<div
				transition:fly={{ y: 16, duration: 180 }}
				class="pointer-events-auto max-w-sm rounded-full bg-slate-950/95 dark:bg-white/95 px-4.5 py-2.5 text-sm font-semibold text-white dark:text-slate-950 shadow-xl backdrop-blur flex items-center gap-2 border border-white/10 dark:border-black/10"
			>
				{#if toast.current.type === 'error'}
					<Icon name="cross-circle" class="text-xs text-rose-400 dark:text-rose-500 shrink-0" />
				{:else}
					<Icon name="check" class="text-xs text-emerald-400 dark:text-emerald-600 shrink-0" />
				{/if}
				<span>{toast.current.text}</span>
			</div>
		{/key}
	{/if}
</div>
