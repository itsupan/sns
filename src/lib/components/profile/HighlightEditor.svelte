<script lang="ts">
	import { untrack } from 'svelte';
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import StoryThumb from '$lib/components/stories/StoryThumb.svelte';
	import { MAX_HIGHLIGHT_TITLE, type HighlightData, type SavedStory } from '$lib/highlights';
	import { formatStoryDate } from '$lib/stories';
	import { readApiError } from '$lib/utils/api-error';
	import { toast } from '$lib/utils/toast.svelte';
	import { m } from '$lib/i18n';

	interface Props {
		open?: boolean;
		/** One of your highlights. */
		highlight: HighlightData;
		onSaved?: (highlight: HighlightData) => void;
	}

	let { open = $bindable(false), highlight, onSaved }: Props = $props();

	let title = $state('');
	let stories = $state<SavedStory[]>([]);
	let coverStoryId = $state<string | null>(null);
	let saving = $state(false);

	// Every open starts from the highlight as it is.
	$effect(() => {
		if (!open) return;
		untrack(() => {
			title = highlight.title;
			stories = [...highlight.stories];
			coverStoryId = highlight.coverStoryId;
		});
	});

	let cover = $derived(stories.find((s) => s.id === coverStoryId) ?? stories[0]);

	function move(index: number, by: -1 | 1) {
		const next = [...stories];
		[next[index], next[index + by]] = [next[index + by], next[index]];
		stories = next;
	}

	function remove(story: SavedStory) {
		stories = stories.filter((s) => s.id !== story.id);
		if (coverStoryId === story.id) coverStoryId = null;
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (saving) return;
		const name = title.trim();
		const storyIds = stories.map((s) => s.id);
		const reordered = storyIds.join() !== highlight.stories.map((s) => s.id).join();
		const changes = {
			title: name !== highlight.title ? name : undefined,
			coverStoryId: coverStoryId !== highlight.coverStoryId ? coverStoryId : undefined,
			storyIds: reordered ? storyIds : undefined
		};
		if (Object.values(changes).every((value) => value === undefined)) {
			open = false;
			return;
		}

		saving = true;
		try {
			const res = await fetch(`/api/highlights/${encodeURIComponent(highlight.id)}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(changes)
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				toast.show(readApiError(body, m.highlight_save_error()).message);
				return;
			}
			onSaved?.({ ...highlight, title: name, coverStoryId, stories });
			toast.show(m.highlight_saved());
			open = false;
		} catch {
			toast.show(m.highlight_save_error());
		} finally {
			saving = false;
		}
	}

	const iconButton =
		'size-9 shrink-0 rounded-full flex items-center justify-center bg-transparent hover:bg-slate-100 dark:hover:bg-dark-elevated border-0 cursor-pointer text-slate-700 dark:text-dark-text disabled:opacity-30 disabled:cursor-default';
</script>

<BottomSheet bind:open title={m.highlight_edit()} showTitle>
	<form id="highlight-editor" class="flex flex-col gap-4 px-3 pb-2" onsubmit={save}>
		<label class="flex flex-col gap-1.5 text-xs font-semibold text-slate-600 dark:text-dark-muted">
			{m.highlight_title()}
			<input
				bind:value={title}
				type="text"
				required
				maxlength={MAX_HIGHLIGHT_TITLE}
				class="h-10 px-4 rounded-full bg-slate-100 dark:bg-dark-elevated border-0 text-sm font-normal text-slate-900 dark:text-dark-text focus:outline-2 focus:outline-blue-600 dark:focus:outline-kizuna-blue"
			/>
		</label>

		<fieldset class="m-0 p-0 border-0 flex flex-col gap-1">
			<legend class="mb-1.5 text-xs font-semibold text-slate-600 dark:text-dark-muted">
				{m.highlight_pick_cover()}
			</legend>
			{#each stories as story, index (story.id)}
				{@const date = formatStoryDate(story.createdAt)}
				<div class="flex items-center gap-3 py-1">
					<label class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
						<input
							type="radio"
							name="cover"
							class="sr-only peer"
							checked={cover?.id === story.id}
							onchange={() => (coverStoryId = story.id)}
							aria-label={m.highlight_cover_from(date)}
						/>
						<span
							class="size-14 shrink-0 rounded-xl overflow-hidden bg-slate-100 dark:bg-dark-elevated ring-offset-2 ring-offset-white dark:ring-offset-dark-card peer-checked:ring-2 peer-checked:ring-blue-600 dark:peer-checked:ring-kizuna-blue peer-focus-visible:ring-2 peer-focus-visible:ring-slate-400"
						>
							<StoryThumb {story} />
						</span>
						<span class="flex flex-col min-w-0 leading-tight">
							<span class="text-sm text-slate-900 dark:text-dark-text">{date}</span>
							{#if cover?.id === story.id}
								<span class="text-xs font-semibold text-blue-600 dark:text-kizuna-blue"
									>{m.highlight_cover()}</span
								>
							{/if}
						</span>
					</label>
					<button
						type="button"
						class={iconButton}
						disabled={index === 0}
						onclick={() => move(index, -1)}
						aria-label={m.highlight_move_earlier(date)}
					>
						<Icon name="angle-down" class="rotate-180" />
					</button>
					<button
						type="button"
						class={iconButton}
						disabled={index === stories.length - 1}
						onclick={() => move(index, 1)}
						aria-label={m.highlight_move_later(date)}
					>
						<Icon name="angle-down" />
					</button>
					<button
						type="button"
						class={iconButton}
						disabled={stories.length === 1}
						onclick={() => remove(story)}
						aria-label={m.highlight_remove_story(date)}
					>
						<Icon name="cross" />
					</button>
				</div>
			{:else}
				<p class="m-0 py-4 text-center text-xs text-slate-500 dark:text-dark-muted">
					{m.highlight_no_stories()}
				</p>
			{/each}
		</fieldset>
	</form>

	{#snippet footer()}
		<div class="flex justify-end gap-2">
			<button
				type="button"
				class="h-10 px-4 rounded-full text-sm font-semibold bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text border-0 cursor-pointer hover:bg-slate-200 dark:hover:bg-dark-hover"
				onclick={() => (open = false)}
			>
				{m.common_cancel()}
			</button>
			<button
				type="submit"
				form="highlight-editor"
				class="h-10 px-5 rounded-full text-sm font-semibold bg-slate-950 dark:bg-white text-white dark:text-slate-950 border-0 cursor-pointer disabled:opacity-40 disabled:cursor-default"
				disabled={saving || !title.trim()}
			>
				{saving ? m.common_saving() : m.common_save()}
			</button>
		</div>
	{/snippet}
</BottomSheet>
