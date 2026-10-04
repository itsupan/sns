<script lang="ts">
	import { untrack } from 'svelte';
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { MAX_HIGHLIGHT_TITLE, highlightCover, type HighlightData } from '$lib/highlights';
	import { readApiError } from '$lib/utils/api-error';
	import { toast } from '$lib/utils/toast.svelte';
	import { m } from '$lib/i18n';
	import StoryThumb from './StoryThumb.svelte';

	interface Props {
		open?: boolean;
		/** One of your stories, live or expired. */
		storyId: string;
		/** Your id: the highlights listed are yours. */
		userId: string;
		onChange?: () => void;
	}

	let { open = $bindable(false), storyId, userId, onChange }: Props = $props();

	let highlights = $state<HighlightData[]>([]);
	let loaded = $state(false);
	let busy = $state(false);
	let title = $state('');

	// Fresh on every open: highlights may have changed since.
	$effect(() => {
		if (!open) return;
		untrack(() => {
			loaded = false;
			title = '';
			load();
		});
	});

	async function load() {
		try {
			const res = await fetch(`/api/users/${encodeURIComponent(userId)}/highlights`);
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(readApiError(body, m.highlight_load_error()).message);
			highlights = (body as { highlights: HighlightData[] }).highlights;
			loaded = true;
		} catch (err) {
			toast.show(err instanceof Error ? err.message : m.highlight_load_error());
			open = false;
		}
	}

	const holds = (highlight: HighlightData) => highlight.stories.some((s) => s.id === storyId);

	/** Sends one change, then reloads the list so it shows what the server kept. */
	async function change(request: () => Promise<Response>, done: string): Promise<boolean> {
		if (busy) return false;
		busy = true;
		try {
			const res = await request();
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				toast.show(readApiError(body, m.highlight_update_error()).message);
				return false;
			}
			toast.show(done);
			onChange?.();
			await load();
			return true;
		} catch {
			toast.show(m.highlight_update_error());
			return false;
		} finally {
			busy = false;
		}
	}

	function toggle(highlight: HighlightData) {
		const remove = holds(highlight);
		return change(
			() =>
				fetch(`/api/highlights/${encodeURIComponent(highlight.id)}/items`, {
					method: remove ? 'DELETE' : 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ storyId })
				}),
			remove ? m.highlight_removed_from(highlight.title) : m.highlight_added_to(highlight.title)
		);
	}

	async function create(e: SubmitEvent) {
		e.preventDefault();
		const name = title.trim();
		if (!name) return;
		const created = await change(
			() =>
				fetch('/api/highlights', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ title: name, storyId })
				}),
			m.highlight_added_to(name)
		);
		if (created) title = '';
	}
</script>

<BottomSheet bind:open title={m.highlight_add_to()} showTitle>
	<ul class="list-none m-0 p-0" aria-busy={!loaded}>
		{#if !loaded}
			{#each [0, 1] as i (i)}
				<li class="flex items-center gap-3 px-3 py-2" aria-hidden="true">
					<div class="size-12 rounded-full bg-slate-100 dark:bg-dark-elevated animate-pulse"></div>
					<div class="h-3 w-28 rounded-full bg-slate-100 dark:bg-dark-elevated animate-pulse"></div>
				</li>
			{/each}
		{:else}
			{#each highlights as highlight (highlight.id)}
				{@const cover = highlightCover(highlight)}
				{@const added = holds(highlight)}
				<li>
					<button
						type="button"
						class="w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-left bg-transparent border-0 cursor-pointer text-inherit hover:bg-slate-50 dark:hover:bg-dark-elevated disabled:cursor-default"
						aria-pressed={added}
						disabled={busy}
						onclick={() => toggle(highlight)}
					>
						<span
							class="size-12 shrink-0 rounded-full overflow-hidden bg-slate-100 dark:bg-dark-elevated"
						>
							{#if cover}<StoryThumb story={cover} />{/if}
						</span>
						<span class="flex flex-col min-w-0 flex-1 leading-tight">
							<span class="text-sm font-semibold truncate">{highlight.title}</span>
							<span class="text-xs text-slate-500 dark:text-dark-muted">
								{m.highlight_story_count(highlight.stories.length)}
							</span>
						</span>
						{#if added}
							<Icon name="check-circle" class="text-lg text-blue-600 dark:text-kizuna-blue" />
						{/if}
					</button>
				</li>
			{:else}
				<li class="px-3 py-6 text-center text-xs text-slate-500 dark:text-dark-muted">
					{m.highlight_none_yet()}
				</li>
			{/each}
		{/if}
	</ul>

	{#snippet footer()}
		<form class="flex items-center gap-2" onsubmit={create}>
			<input
				bind:value={title}
				type="text"
				maxlength={MAX_HIGHLIGHT_TITLE}
				placeholder={m.highlight_new_placeholder()}
				aria-label={m.highlight_new_title_label()}
				class="flex-1 min-w-0 h-10 px-4 rounded-full bg-slate-100 dark:bg-dark-elevated border-0 text-sm text-slate-900 dark:text-dark-text placeholder:text-slate-500 dark:placeholder:text-dark-muted focus:outline-2 focus:outline-blue-600 dark:focus:outline-kizuna-blue"
			/>
			<button
				type="submit"
				class="shrink-0 h-10 px-4 rounded-full text-sm font-semibold bg-slate-950 dark:bg-white text-white dark:text-slate-950 border-0 cursor-pointer disabled:opacity-40 disabled:cursor-default"
				disabled={busy || !title.trim()}
			>
				{m.highlight_create()}
			</button>
		</form>
	{/snippet}
</BottomSheet>
