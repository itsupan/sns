<script lang="ts">
	import { MAX_ALT_LENGTH } from '$lib/constants/post-limits';
	import type { PostDraft } from './post-draft.svelte';

	let { draft }: { draft: PostDraft } = $props();
</script>

<!-- One alt text field per image, so screen readers can describe each slide. -->
{#if draft.mediaPlates.some((p) => p.type === 'image')}
	<div class="flex flex-col gap-2">
		{#each draft.mediaPlates as plate, idx (plate.id)}
			{#if plate.type === 'image'}
				<label
					class="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-elevated/50 text-xs"
				>
					<img src={plate.previewUrl} alt="" class="size-8 rounded-md object-cover shrink-0" />
					<span class="shrink-0 font-medium text-slate-600 dark:text-dark-muted">
						Alt text <span class="sr-only">for image {idx + 1}</span>
					</span>
					<input
						type="text"
						bind:value={plate.alt}
						maxlength={MAX_ALT_LENGTH}
						placeholder="Describe this image for people who can't see it"
						class="flex-1 min-w-0 bg-transparent border-0 text-slate-900 dark:text-dark-text placeholder:text-slate-400 focus:outline-none"
					/>
				</label>
			{/if}
		{/each}
	</div>
{/if}
