<script lang="ts">
	import Icon from '$lib/components/shared/Icon.svelte';
	import LoadMore from '$lib/components/shared/LoadMore.svelte';
	import HighlightPicker from '$lib/components/stories/HighlightPicker.svelte';
	import StoryThumb from '$lib/components/stories/StoryThumb.svelte';
	import StoryViewer from '$lib/components/stories/StoryViewer.svelte';
	import type { Story, StoryGroup } from '$lib/components/stories/stories.svelte';
	import type { SavedStory } from '$lib/highlights';
	import { formatStoryDate } from '$lib/stories';
	import { readApiError } from '$lib/utils/api-error';
	import { m } from '$lib/i18n';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Pages loaded while scrolling, appended after the first one. */
	let more = $state<SavedStory[]>([]);
	let moreCursor = $state<string | null | undefined>(undefined);
	let loadingMore = $state(false);
	let loadError = $state<string | null>(null);
	let deleted = $state<string[]>([]);

	let stories = $derived.by(() => {
		const seen = new Set(data.stories.map((s) => s.id));
		return [...data.stories, ...more.filter((s) => !seen.has(s.id))].filter(
			(s) => !deleted.includes(s.id)
		);
	});
	let nextCursor = $derived(moreCursor === undefined ? data.nextCursor : moreCursor);

	let viewerOpen = $state(false);
	let viewerGroups = $state<StoryGroup[]>([]);
	let pickerOpen = $state(false);
	let pickedId = $state<string | null>(null);

	async function loadMore() {
		if (!nextCursor || loadingMore) return;
		loadingMore = true;
		loadError = null;
		try {
			const res = await fetch(`/api/stories/archive?cursor=${encodeURIComponent(nextCursor)}`);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				loadError = readApiError(body, m.story_archive_load_error()).message;
				return;
			}
			const page = body as { stories: SavedStory[]; nextCursor: string | null };
			more = [...more, ...page.stories];
			moreCursor = page.nextCursor;
		} catch {
			loadError = m.story_archive_load_error();
		} finally {
			loadingMore = false;
		}
	}

	function play(story: SavedStory) {
		viewerGroups = [{ user: data.user, isSelf: true, stories: [story] }];
		viewerOpen = true;
	}

	function addToHighlight(story: SavedStory) {
		pickedId = story.id;
		pickerOpen = true;
	}

	function handleDeleted(story: Story) {
		deleted = [...deleted, story.id];
		viewerGroups = [];
	}
</script>

<svelte:head>
	<title>{m.story_archive_title()}</title>
</svelte:head>

<main class="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
	<div>
		<h1 class="text-xl font-bold tracking-tight text-slate-950 dark:text-white m-0">
			{m.profile_archive()}
		</h1>
		<p class="text-xs text-slate-500 dark:text-dark-muted m-0 mt-1">
			{m.story_archive_hint()}
		</p>
	</div>

	{#if stories.length === 0}
		<div
			class="rounded-3xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card py-16 px-6 flex flex-col items-center gap-2 text-center"
		>
			<Icon name="clock" class="text-3xl text-slate-300" />
			<p class="text-sm font-semibold text-slate-900 dark:text-dark-text m-0">
				{m.story_archive_empty()}
			</p>
			<p class="text-xs text-slate-500 dark:text-dark-muted m-0">
				{m.story_archive_empty_hint()}
			</p>
		</div>
	{:else}
		<ul class="list-none m-0 p-0 grid grid-cols-3 gap-1">
			{#each stories as story (story.id)}
				{@const date = formatStoryDate(story.createdAt)}
				{@const closeFriends = story.audience === 'close_friends'}
				<li
					class="relative aspect-9/16 rounded-xl overflow-hidden bg-slate-100 dark:bg-dark-elevated"
				>
					<button
						type="button"
						class="absolute inset-0 p-0 border-0 bg-transparent cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-kizuna-blue {closeFriends
							? 'ring-2 ring-inset ring-green-500'
							: ''}"
						onclick={() => play(story)}
						aria-label={m.story_archived(date, closeFriends)}
					>
						<StoryThumb {story} />
					</button>
					<span
						class="pointer-events-none absolute top-1.5 left-1.5 px-2 py-0.5 rounded-lg bg-black/55 text-white text-[10px] font-semibold"
						aria-hidden="true"
					>
						{date}
					</span>
					<button
						type="button"
						class="absolute bottom-1.5 right-1.5 size-8 rounded-full bg-black/55 hover:bg-black/70 text-white flex items-center justify-center border-0 cursor-pointer p-0"
						onclick={() => addToHighlight(story)}
						aria-label={m.story_add_to_highlight(date)}
					>
						<Icon name="plus" class="text-sm" />
					</button>
				</li>
			{/each}
		</ul>

		{#if nextCursor}
			<LoadMore onLoad={loadMore} loading={loadingMore} error={loadError} />
		{/if}
	{/if}
</main>

<StoryViewer bind:open={viewerOpen} groups={viewerGroups} live={false} onDeleted={handleDeleted} />

{#if pickedId}
	<HighlightPicker bind:open={pickerOpen} storyId={pickedId} userId={data.user.id} />
{/if}
