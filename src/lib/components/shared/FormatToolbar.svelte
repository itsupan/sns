<script lang="ts">
	import { formatTextarea, type FormatKind } from '$lib/formatting-editor';

	interface Props {
		/** The textarea the buttons format. */
		target: HTMLTextAreaElement | null;
		class?: string;
	}

	let { target, class: className = '' }: Props = $props();

	const buttons: { kind: FormatKind; label: string; text: string; style: string }[] = [
		{ kind: 'bold', label: 'Bold (Ctrl+B)', text: 'B', style: 'font-bold' },
		{ kind: 'italic', label: 'Italic (Ctrl+I)', text: 'I', style: 'italic' },
		{ kind: 'underline', label: 'Underline (Ctrl+U)', text: 'U', style: 'underline' },
		{ kind: 'list', label: 'Bulleted list', text: '•', style: 'font-bold' }
	];
</script>

<div class="flex items-center gap-1 {className}" role="toolbar" aria-label="Text formatting">
	{#each buttons as b (b.kind)}
		<button
			type="button"
			aria-label={b.label}
			title={b.label}
			class="w-7 h-7 inline-flex items-center justify-center rounded-lg text-sm text-slate-600 dark:text-dark-muted hover:bg-slate-100 dark:hover:bg-dark-elevated hover:text-slate-900 dark:hover:text-dark-text {b.style}"
			onmousedown={(e) => e.preventDefault()}
			onclick={() => target && formatTextarea(target, b.kind)}
		>
			{b.text}
		</button>
	{/each}
</div>
