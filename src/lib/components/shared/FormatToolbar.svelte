<script lang="ts">
	import { formatTextarea, type FormatKind } from '$lib/formatting-editor';
	import { m } from '$lib/i18n';

	interface Props {
		/** The textarea the buttons format. */
		target: HTMLTextAreaElement | null;
		class?: string;
	}

	let { target, class: className = '' }: Props = $props();

	const buttons: { kind: FormatKind; label: string; text: string; style: string }[] = [
		{ kind: 'bold', label: m.composer_format_bold(), text: 'B', style: 'font-bold' },
		{ kind: 'italic', label: m.composer_format_italic(), text: 'I', style: 'italic' },
		{ kind: 'underline', label: m.composer_format_underline(), text: 'U', style: 'underline' },
		{ kind: 'list', label: m.composer_format_list(), text: '•', style: 'font-bold' }
	];
</script>

<div
	class="flex items-center gap-1 {className}"
	role="toolbar"
	aria-label={m.composer_format_label()}
>
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
