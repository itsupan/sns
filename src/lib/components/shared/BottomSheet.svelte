<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	interface Props {
		open?: boolean;
		/** Accessible title, also rendered as the sheet heading when `showTitle` is set */
		title: string;
		showTitle?: boolean;
		onclose?: () => void;
		children?: Snippet;
		footer?: Snippet;
	}

	let {
		open = $bindable(false),
		title,
		showTitle = false,
		onclose,
		children,
		footer
	}: Props = $props();

	let sheet = $state<HTMLDivElement | null>(null);
	let dragOffset = $state(0);
	let dragStartY = $state<number | null>(null);

	function close() {
		open = false;
		dragOffset = 0;
		onclose?.();
	}

	function onKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') close();
	}

	function onPointerDown(event: PointerEvent) {
		dragStartY = event.clientY;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function onPointerMove(event: PointerEvent) {
		if (dragStartY === null) return;
		dragOffset = Math.max(0, event.clientY - dragStartY);
	}

	function onPointerUp() {
		if (dragStartY === null) return;
		dragStartY = null;
		if (dragOffset > 90) close();
		else dragOffset = 0;
	}

	// Lock page scroll and move focus into the sheet while it is open.
	$effect(() => {
		if (!open) return;
		const previous = document.body.style.overflow;
		const previousFocus = document.activeElement as HTMLElement | null;
		document.body.style.overflow = 'hidden';
		queueMicrotask(() => {
			const target = sheet?.querySelector<HTMLElement>('[autofocus], textarea, input, button');
			(target ?? sheet)?.focus();
		});
		return () => {
			document.body.style.overflow = previous;
			previousFocus?.focus?.();
		};
	});
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<div class="fixed inset-0 z-50 flex items-end justify-center md:items-center">
		<button
			type="button"
			class="absolute inset-0 bg-black/40 backdrop-blur-[2px] cursor-default border-0"
			aria-label="Close"
			tabindex="-1"
			onclick={close}
			transition:fade={{ duration: 150 }}
		></button>

		<div
			bind:this={sheet}
			role="dialog"
			aria-modal="true"
			aria-label={title}
			tabindex="-1"
			class="relative w-full max-w-lg max-h-[90dvh] flex flex-col bg-white dark:bg-dark-card rounded-t-3xl md:rounded-3xl shadow-2xl pb-safe outline-none"
			style:transform={dragOffset ? `translateY(${dragOffset}px)` : undefined}
			style:transition={dragStartY === null ? 'transform 0.2s ease' : 'none'}
			transition:fly={{ y: 400, duration: 220, opacity: 1 }}
		>
			<div
				class="flex justify-center pt-3 pb-2 touch-none cursor-grab md:hidden"
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				onpointercancel={onPointerUp}
				aria-hidden="true"
			>
				<span class="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-dark-hover"></span>
			</div>

			{#if showTitle}
				<h2
					class="px-5 pt-1 pb-3 md:pt-5 text-base font-semibold text-slate-950 dark:text-dark-text"
				>
					{title}
				</h2>
			{/if}

			<div class="flex-1 overflow-y-auto overscroll-contain px-2 md:px-3 pb-2">
				{@render children?.()}
			</div>

			{#if footer}
				<div class="border-t border-slate-100 dark:border-dark-border px-4 py-3">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
