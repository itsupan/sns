<script lang="ts">
	import { tick } from 'svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import {
		MAX_POLL_OPTIONS,
		MAX_POLL_OPTION_LENGTH,
		MIN_POLL_OPTIONS,
		POLL_DURATIONS
	} from '$lib/polls';
	import { m } from '$lib/i18n';
	import type { PostDraft } from './post-draft.svelte';

	let { draft }: { draft: PostDraft } = $props();

	let optionInputs = $state<Record<string, HTMLInputElement>>({});
	let addPollButton = $state<HTMLButtonElement | null>(null);

	/** Focuses the option at `index`, or the last one if it is gone, once the DOM has caught up. */
	async function focusOption(index: number) {
		await tick();
		const options = draft.pollOptions ?? [];
		const option = options[Math.min(index, options.length - 1)];
		if (option) optionInputs[option.id]?.focus();
	}

	function addPoll() {
		draft.addPoll();
		focusOption(0);
	}

	async function removePoll() {
		draft.removePoll();
		await tick();
		addPollButton?.focus();
	}

	function addOption() {
		draft.addPollOption();
		focusOption((draft.pollOptions?.length ?? 1) - 1);
	}

	function removeOption(id: string, index: number) {
		draft.removePollOption(id);
		focusOption(index);
	}
</script>

{#if draft.pollOptions}
	<fieldset
		class="flex flex-col gap-2 m-0 p-3 rounded-2xl border border-slate-200 dark:border-dark-border"
	>
		<legend class="px-1 text-xs font-semibold text-slate-600 dark:text-dark-muted">
			{m.poll_label()}
		</legend>
		{#each draft.pollOptions as option, idx (option.id)}
			<div class="flex items-center gap-2">
				<input
					bind:this={optionInputs[option.id]}
					bind:value={option.label}
					type="text"
					maxlength={MAX_POLL_OPTION_LENGTH}
					placeholder={m.poll_option(idx + 1)}
					aria-label={m.poll_option(idx + 1)}
					class="flex-1 min-w-0 h-10 px-3 rounded-xl bg-slate-50 dark:bg-dark-elevated/50 text-sm text-slate-900 dark:text-dark-text placeholder:text-slate-400 border-0 focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-white"
				/>
				{#if draft.pollOptions.length > MIN_POLL_OPTIONS}
					<button
						type="button"
						class="size-9 shrink-0 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-hover border-0 bg-transparent cursor-pointer"
						aria-label={m.poll_remove_option(idx + 1)}
						onclick={() => removeOption(option.id, idx)}
					>
						<Icon name="cross" class="text-sm" />
					</button>
				{/if}
			</div>
		{/each}
		{#if draft.pollOptions.length < MAX_POLL_OPTIONS}
			<button
				type="button"
				class="self-start flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold text-blue-600 dark:text-kizuna-blue hover:bg-slate-100 dark:hover:bg-dark-hover border-0 bg-transparent cursor-pointer"
				onclick={addOption}
			>
				<Icon name="plus" class="text-xs" />
				{m.poll_add_option()}
			</button>
		{/if}
		<div class="flex items-center justify-between gap-2 pt-1">
			<label
				class="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-dark-muted"
			>
				{m.poll_length()}
				<select
					bind:value={draft.pollDuration}
					class="h-9 px-2 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated text-xs text-slate-900 dark:text-dark-text"
				>
					{#each POLL_DURATIONS as duration (duration.minutes)}
						<option value={duration.minutes}>{duration.label}</option>
					{/each}
				</select>
			</label>
			<button
				type="button"
				class="h-9 px-3 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border-0 bg-transparent cursor-pointer"
				onclick={removePoll}
			>
				{m.poll_remove()}
			</button>
		</div>
	</fieldset>
{:else}
	<button
		bind:this={addPollButton}
		type="button"
		class="self-start flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-text border-0 cursor-pointer active:scale-95 transition"
		onclick={addPoll}
	>
		<Icon name="plus" class="text-xs" />
		{m.poll_add()}
	</button>
{/if}
