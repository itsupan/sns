<script lang="ts">
	import FormattedText from '$lib/components/shared/FormattedText.svelte';
	import { TEXT_BACKGROUNDS, TEXT_BACKGROUND_KEYS } from '$lib/post-backgrounds';
	import { m } from '$lib/i18n';
	import type { PostDraft } from './post-draft.svelte';

	let { draft }: { draft: PostDraft } = $props();
</script>

<div class="flex flex-col gap-2.5">
	<div
		class="aspect-[4/3] rounded-2xl flex items-center justify-center p-6 text-center text-white text-xl font-semibold leading-snug overflow-hidden {TEXT_BACKGROUNDS[
			draft.background
		]}"
		data-testid="text-post-preview"
	>
		{#if draft.content.trim()}
			<FormattedText text={draft.content} class="max-w-full drop-shadow-sm" />
		{:else}
			<span class="text-white/75">{m.composer_text_preview()}</span>
		{/if}
	</div>
	<div class="flex items-center gap-2" role="radiogroup" aria-label={m.composer_background()}>
		{#each TEXT_BACKGROUND_KEYS as key (key)}
			<button
				type="button"
				role="radio"
				aria-checked={draft.background === key}
				aria-label={m.composer_background_option(key)}
				class="size-8 rounded-full border-2 cursor-pointer transition {TEXT_BACKGROUNDS[
					key
				]} {draft.background === key
					? 'border-slate-950 dark:border-white scale-110'
					: 'border-transparent'}"
				onclick={() => (draft.background = key)}
			></button>
		{/each}
	</div>
</div>
