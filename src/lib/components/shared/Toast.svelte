<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toast } from '$lib/utils/toast.svelte';
</script>

<div
	class="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-8"
	aria-live="polite"
	role="status"
>
	{#if toast.current}
		{#key toast.current.id}
			<div
				transition:fly={{ y: 16, duration: 180 }}
				class="pointer-events-auto max-w-sm rounded-full bg-slate-950/95 dark:bg-white/95 px-4 py-2.5 text-sm font-medium text-white dark:text-slate-950 shadow-lg backdrop-blur"
			>
				{toast.current.text}
			</div>
		{/key}
	{/if}
</div>
