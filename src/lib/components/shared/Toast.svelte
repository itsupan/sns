<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toast } from '$lib/utils/toast.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';

	// A popover, to share the top layer with modals. It stays open so screen readers know the live
	// region before its first message, and reopens for each toast to land above newer modals.
	function raise(region: HTMLElement) {
		if (toast.current) region.hidePopover();
		region.showPopover();
	}
</script>

<div
	{@attach raise}
	popover="manual"
	class="pointer-events-none inset-x-0 top-auto w-auto overflow-visible bg-transparent flex justify-center px-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-8"
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
