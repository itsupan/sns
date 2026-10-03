<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { toast } from '$lib/utils/toast.svelte';
	import {
		MAX_SCHEDULE_LEAD_MS,
		MIN_SCHEDULE_LEAD_MS,
		formatPublishAt,
		toLocalInputValue
	} from '$lib/drafts';
	import type { PostDraft } from './post-draft.svelte';

	interface Props {
		draft: PostDraft;
		/** Prefix for element ids: the composer renders a mobile and a desktop copy. */
		id: string;
		/** Nothing to save yet, or a publish or upload is running. */
		disabled: boolean;
		/** Called before saving; return false to block (e.g. signed out). */
		beforeSave: () => boolean;
		/** Called once the draft is saved, to clear and close the composer. */
		onsaved: () => void;
	}

	let { draft, id, disabled, beforeSave, onsaved }: Props = $props();

	let saving = $state(false);
	let scheduleOpen = $state(false);
	let publishAt = $state('');
	let min = $state('');
	let max = $state('');

	function toggleSchedule() {
		if (scheduleOpen) {
			scheduleOpen = false;
			return;
		}
		const now = Date.now();
		// The input has minute precision: a minute of slack keeps its earliest choice valid on save.
		min = toLocalInputValue(new Date(now + MIN_SCHEDULE_LEAD_MS + 60_000));
		max = toLocalInputValue(new Date(now + MAX_SCHEDULE_LEAD_MS));
		publishAt = draft.scheduledAt ? toLocalInputValue(new Date(draft.scheduledAt)) : min;
		scheduleOpen = true;
	}

	async function save(at: Date | null) {
		if (disabled || saving || !beforeSave()) return;
		saving = true;
		try {
			const saved = await draft.saveDraft(at);
			toast.show(
				saved.publishAt ? `Scheduled for ${formatPublishAt(saved.publishAt)}` : 'Draft saved'
			);
			scheduleOpen = false;
			onsaved();
		} catch (err) {
			toast.show(err instanceof Error ? err.message : 'Could not save the draft');
		} finally {
			saving = false;
		}
	}
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center justify-between gap-2">
		<a
			href={resolve('/drafts')}
			class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-dark-muted hover:text-slate-900 dark:hover:text-white no-underline transition-colors"
		>
			<Icon name="document" class="text-xs" />
			<span>Drafts</span>
		</a>
		<div class="flex items-center gap-1.5">
			<button
				type="button"
				onclick={() => save(null)}
				disabled={disabled || saving}
				class="h-8 px-3.5 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-800 dark:text-dark-text font-semibold text-xs border-0 cursor-pointer hover:bg-slate-200 dark:hover:bg-dark-hover disabled:opacity-40 disabled:cursor-not-allowed transition"
			>
				{saving && !scheduleOpen ? 'Saving…' : 'Save draft'}
			</button>
			<button
				type="button"
				onclick={toggleSchedule}
				disabled={disabled || saving}
				aria-expanded={scheduleOpen}
				class="h-8 px-3.5 rounded-full font-semibold text-xs border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5 {scheduleOpen
					? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
					: 'bg-slate-100 dark:bg-dark-elevated text-slate-800 dark:text-dark-text hover:bg-slate-200 dark:hover:bg-dark-hover'}"
			>
				<Icon name="clock" class="text-xs" />
				<span>Schedule</span>
			</button>
		</div>
	</div>

	{#if scheduleOpen}
		<div
			class="flex flex-wrap items-center gap-2 p-2.5 rounded-2xl bg-slate-50 dark:bg-dark-elevated/40 border border-slate-100 dark:border-dark-border text-xs"
		>
			<label for="{id}-publish-at" class="font-medium text-slate-600 dark:text-dark-muted">
				Publish at
			</label>
			<input
				id="{id}-publish-at"
				type="datetime-local"
				bind:value={publishAt}
				{min}
				{max}
				required
				class="flex-1 min-w-0 h-8 px-2.5 rounded-xl bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text border border-slate-200 dark:border-dark-border focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-white"
			/>
			<button
				type="button"
				onclick={() => save(new Date(publishAt))}
				disabled={disabled || saving || !publishAt}
				class="h-8 px-3.5 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-semibold text-xs border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition"
			>
				{saving ? 'Scheduling…' : 'Schedule post'}
			</button>
		</div>
	{:else if draft.scheduledAt}
		<p class="m-0 text-[11px] text-slate-500 dark:text-dark-muted">
			Scheduled for {formatPublishAt(draft.scheduledAt)}. Saving it as a draft unschedules it.
		</p>
	{/if}
</div>
