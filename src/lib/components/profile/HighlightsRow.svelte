<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import SheetAction from '$lib/components/shared/SheetAction.svelte';
	import StoryThumb from '$lib/components/stories/StoryThumb.svelte';
	import StoryViewer from '$lib/components/stories/StoryViewer.svelte';
	import type { Story, StoryGroup } from '$lib/components/stories/stories.svelte';
	import { highlightCover, type HighlightData } from '$lib/highlights';
	import { readApiError } from '$lib/utils/api-error';
	import { toast } from '$lib/utils/toast.svelte';
	import { m } from '$lib/i18n';
	import HighlightEditor from './HighlightEditor.svelte';

	interface Props {
		/** Whose highlights these are. */
		owner: StoryGroup['user'];
		/** The viewer is the owner: they can start, edit and delete highlights. */
		isOwner: boolean;
	}

	let { owner, isOwner }: Props = $props();

	let highlights = $state<HighlightData[]>([]);
	let loaded = $state(false);
	let viewerOpen = $state(false);
	let viewerStart = $state(0);
	let viewerGroups = $state<StoryGroup[]>([]);
	// Owner only: the highlight the options, editor and delete confirmation act on.
	let selected = $state<HighlightData | null>(null);
	let optionsOpen = $state(false);
	let editorOpen = $state(false);
	let confirmDelete = $state(false);
	let deleting = $state(false);

	// SvelteKit reuses the profile page between people; each one loads their own.
	$effect(() => {
		const ownerId = owner.id;
		untrack(() => {
			loaded = false;
			highlights = [];
			load(ownerId);
		});
	});

	/** `ownerId`'s highlights; none when they are hidden from the viewer or could not load. */
	async function fetchHighlights(ownerId: string): Promise<HighlightData[]> {
		try {
			const res = await fetch(`/api/users/${encodeURIComponent(ownerId)}/highlights`);
			const body = (await res.json().catch(() => null)) as { highlights?: HighlightData[] } | null;
			return res.ok ? (body?.highlights ?? []) : [];
		} catch {
			return [];
		}
	}

	async function load(ownerId = owner.id) {
		const list = await fetchHighlights(ownerId);
		if (ownerId !== owner.id) return;
		highlights = list;
		loaded = true;
	}

	/** Plays `highlight`; swiping on moves through the next ones, like the stories tray. */
	function play(highlight: HighlightData) {
		const playable = highlights.filter((h) => h.stories.length > 0);
		viewerGroups = playable.map((h) => ({
			user: owner,
			isSelf: isOwner,
			title: h.title,
			stories: h.stories
		}));
		viewerStart = playable.findIndex((h) => h.id === highlight.id);
		viewerOpen = true;
	}

	function openOptions(highlight: HighlightData) {
		selected = highlight;
		optionsOpen = true;
	}

	function handleDeleted(story: Story) {
		highlights = highlights.map((h) => ({
			...h,
			stories: h.stories.filter((s) => s.id !== story.id)
		}));
		viewerGroups = viewerGroups
			.map((g) => ({ ...g, stories: g.stories.filter((s) => s.id !== story.id) }))
			.filter((g) => g.stories.length > 0);
	}

	function handleSaved(updated: HighlightData) {
		highlights = highlights.map((h) => (h.id === updated.id ? updated : h));
	}

	async function deleteSelected() {
		if (!selected || deleting) return;
		const target = selected;
		deleting = true;
		try {
			const res = await fetch(`/api/highlights/${encodeURIComponent(target.id)}`, {
				method: 'DELETE'
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				toast.show(readApiError(body, m.highlight_delete_error()).message);
				return;
			}
			highlights = highlights.filter((h) => h.id !== target.id);
			toast.show(m.highlight_deleted());
		} catch {
			toast.show(m.highlight_delete_error());
		} finally {
			deleting = false;
			confirmDelete = false;
		}
	}

	const circle =
		'size-16 rounded-full p-[2.5px] bg-slate-200 dark:bg-dark-hover flex items-center justify-center';
	const itemButton =
		'w-18 flex flex-col items-center gap-1.5 cursor-pointer bg-transparent border-0 p-0 text-inherit no-underline rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 dark:focus-visible:outline-kizuna-blue active:scale-95 transition-transform';
	const label =
		'w-full truncate text-center text-xs font-medium text-slate-700 dark:text-dark-muted leading-tight';
</script>

{#if loaded && (highlights.length > 0 || isOwner)}
	<nav
		class="w-full overflow-x-auto no-scrollbar py-3 sm:py-4 border-b border-slate-100 dark:border-dark-border"
		aria-label={m.highlight_nav()}
	>
		<ul class="flex items-start gap-3 lg:gap-5 min-w-max px-4 sm:px-0 list-none m-0">
			{#if isOwner}
				<li>
					<a
						href={resolve('/stories/archive')}
						class={itemButton}
						aria-label={m.highlight_new_from_archive()}
					>
						<span
							class="size-16 rounded-full border-1.5 border-dashed border-slate-300 dark:border-dark-border flex items-center justify-center text-slate-500 dark:text-dark-muted bg-slate-50 dark:bg-dark-elevated"
						>
							<Icon name="plus" class="text-lg" />
						</span>
						<span class={label}>{m.highlight_new()}</span>
					</a>
				</li>
			{/if}

			{#each highlights as highlight (highlight.id)}
				{@const cover = highlightCover(highlight)}
				<li class="relative">
					<button
						type="button"
						class={itemButton}
						onclick={() => (cover ? play(highlight) : openOptions(highlight))}
						aria-label={cover
							? m.highlight_play(highlight.title)
							: m.highlight_empty(highlight.title)}
					>
						<span class={circle}>
							<span
								class="size-full rounded-full p-[2px] bg-white dark:bg-dark-card overflow-hidden"
							>
								<span
									class="block size-full rounded-full overflow-hidden bg-slate-100 dark:bg-dark-elevated"
								>
									{#if cover}<StoryThumb story={cover} />{/if}
								</span>
							</span>
						</span>
						<span class={label}>{highlight.title}</span>
					</button>
					{#if isOwner}
						<button
							type="button"
							class="absolute top-11 left-11 size-6 rounded-full bg-white dark:bg-dark-elevated text-slate-700 dark:text-dark-text flex items-center justify-center border border-slate-200 dark:border-dark-border cursor-pointer p-0 shadow-xs"
							onclick={() => openOptions(highlight)}
							aria-label={m.highlight_options(highlight.title)}
						>
							<Icon name="menu-dots" class="text-[10px]" />
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	</nav>
{/if}

<StoryViewer
	bind:open={viewerOpen}
	groups={viewerGroups}
	startIndex={viewerStart}
	live={false}
	onDeleted={handleDeleted}
	onHighlightsChange={() => load()}
/>

{#if isOwner && selected}
	{@const target = selected}
	<BottomSheet bind:open={optionsOpen} title={m.highlight_sheet_title(target.title)}>
		<SheetAction
			icon="pencil"
			label={m.highlight_edit()}
			onclick={() => {
				optionsOpen = false;
				editorOpen = true;
			}}
		/>
		<SheetAction
			icon="trash"
			label={m.highlight_delete()}
			danger
			onclick={() => {
				optionsOpen = false;
				confirmDelete = true;
			}}
		/>
	</BottomSheet>

	<HighlightEditor bind:open={editorOpen} highlight={target} onSaved={handleSaved} />

	<BottomSheet bind:open={confirmDelete} title={m.highlight_confirm_delete(target.title)} showTitle>
		<p class="px-3 pb-2 text-sm text-slate-600 dark:text-dark-muted">
			{m.highlight_delete_hint()}
		</p>
		{#snippet footer()}
			<div class="flex justify-end gap-2">
				<button
					type="button"
					class="h-10 px-4 rounded-full text-sm font-semibold bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text border-0 cursor-pointer hover:bg-slate-200 dark:hover:bg-dark-hover"
					onclick={() => (confirmDelete = false)}
				>
					{m.common_cancel()}
				</button>
				<button
					type="button"
					class="h-10 px-5 rounded-full text-sm font-semibold bg-red-600 text-white border-0 cursor-pointer hover:bg-red-700 disabled:opacity-50 disabled:cursor-default"
					disabled={deleting}
					onclick={deleteSelected}
				>
					{deleting ? m.common_deleting() : m.common_delete()}
				</button>
			</div>
		{/snippet}
	</BottomSheet>
{/if}
