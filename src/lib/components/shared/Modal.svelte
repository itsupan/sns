<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		/** Accessible name of the dialog. */
		label: string;
		/** `center` card, `sheet` rising from the bottom on phones (centered from `md`), or `fullscreen`. */
		variant?: 'center' | 'sheet' | 'fullscreen';
		/** Close on a click outside the content, which lands on the dialog itself. */
		closeOnBackdrop?: boolean;
		/** Called when Escape or a backdrop click closed the modal (not when `open` is set to false). */
		onclose?: () => void;
		/** Keys pressed in the dialog; preventing Escape's default keeps it open. */
		onkeydown?: (event: KeyboardEvent) => void;
		/** Classes for the dialog itself, which fills the viewport. */
		class?: string;
		children: Snippet;
	}

	let {
		open = $bindable(false),
		label,
		variant = 'center',
		closeOnBackdrop = true,
		onclose,
		onkeydown,
		class: className = '',
		children
	}: Props = $props();

	const LAYOUT = {
		center: 'items-center justify-center p-4 backdrop:bg-black/60 backdrop:backdrop-blur-xs',
		sheet:
			'items-end justify-center md:items-center md:p-4 backdrop:bg-black/60 backdrop:backdrop-blur-xs',
		fullscreen: 'backdrop:bg-transparent'
	};

	// showModal() puts the dialog in the top layer and makes the rest of the page inert: focus
	// moves in (to the `autofocus` element, else the first focusable one) and cannot leave.
	function showModal(dialog: HTMLDialogElement) {
		const opener = document.activeElement;
		dialog.showModal();
		return () => {
			if (opener instanceof HTMLElement) opener.focus();
		};
	}

	function dismiss() {
		open = false;
		onclose?.();
	}

	function oncancel(event: Event) {
		// A file input's `cancel` (picker dismissed) bubbles up to here too.
		if (event.target !== event.currentTarget) return;
		event.preventDefault();
		dismiss();
	}

	// The dialog fills the viewport, so a press on it is a press on the backdrop. Both ends must
	// land there: a text selection dragged out of the content also "clicks" the dialog.
	let pressedBackdrop = false;

	function onpointerdown(event: PointerEvent) {
		pressedBackdrop = event.target === event.currentTarget;
	}

	function onclick(event: MouseEvent) {
		if (closeOnBackdrop && pressedBackdrop && event.target === event.currentTarget) dismiss();
	}
</script>

{#if open}
	<!-- tabindex: a click on plain content focuses the dialog rather than the inert page. -->
	<dialog
		{@attach showModal}
		aria-label={label}
		tabindex="-1"
		class="modal {variant} size-full max-w-none max-h-none bg-transparent text-inherit outline-none open:flex {LAYOUT[
			variant
		]} {className}"
		{oncancel}
		{onpointerdown}
		{onclick}
		{onkeydown}
	>
		{@render children()}
	</dialog>
{/if}

<style>
	@media (prefers-reduced-motion: no-preference) {
		.modal::backdrop,
		.fullscreen {
			animation: fade-in 150ms ease-out;
		}

		/* The content enters; a nested modal is a child too, and animates itself. */
		.center > :global(:not(dialog)) {
			animation: zoom-in 150ms ease-out;
		}

		.sheet > :global(:not(dialog)) {
			animation: slide-up 220ms ease-out;
		}
	}

	@media (prefers-reduced-motion: no-preference) and (width >= 48rem) {
		.sheet > :global(:not(dialog)) {
			animation: zoom-in 150ms ease-out;
		}
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}

	@keyframes zoom-in {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
	}

	@keyframes slide-up {
		from {
			transform: translateY(100%);
		}
	}
</style>
