<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { authClient } from '$lib/auth-client';
	import { toast } from '$lib/utils/toast.svelte';
	import StoryComposer from '$lib/components/stories/StoryComposer.svelte';
	import StoryViewer from '$lib/components/stories/StoryViewer.svelte';
	import {
		storiesStore,
		type Story,
		type StoryGroup
	} from '$lib/components/stories/stories.svelte';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	const session = authClient.useSession();

	let composerOpen = $state(false);
	let viewerOpen = $state(false);
	let viewerStart = $state(0);
	// Order is frozen while watching, so marking stories seen doesn't reshuffle the viewer.
	let viewerGroups = $state<StoryGroup[]>([]);

	let me = $derived($session.data?.user);
	let own = $derived(storiesStore.own);
	let others = $derived(storiesStore.ordered.filter((g) => !g.isSelf));

	// Load once the session is known; signing in or out reloads the tray.
	let loadedFor: string | null | undefined;
	$effect(() => {
		if ($session.isPending) return;
		const userId = me?.id ?? null;
		if (loadedFor === userId) return;
		loadedFor = userId;
		storiesStore.load();
	});

	function openViewer(group: StoryGroup) {
		viewerGroups = [...storiesStore.ordered];
		viewerStart = Math.max(
			0,
			viewerGroups.findIndex((g) => g.user.id === group.user.id)
		);
		viewerOpen = true;
	}

	async function addStory() {
		if (!me) {
			toast.show('Please log in to share a story');
			const redirectTo = encodeURIComponent(window.location.pathname + window.location.search);
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto(`${resolve('/login')}?redirectTo=${redirectTo}`).catch(() => {});
			return;
		}
		composerOpen = true;
	}

	function handleShared(story: Story) {
		if (!me) return;
		storiesStore.addOwn(story, {
			id: me.id,
			name: me.name,
			handle: (me as { handle?: string | null }).handle ?? null,
			image: me.image ?? null
		});
	}

	function handleDeleted(story: Story) {
		storiesStore.remove(story.id);
		viewerGroups = viewerGroups
			.map((g) => ({ ...g, stories: g.stories.filter((s) => s.id !== story.id) }))
			.filter((g) => g.stories.length > 0);
	}

	const hasCloseFriends = (group: StoryGroup) =>
		group.stories.some((s) => s.audience === 'close_friends');

	function ringClass(group: StoryGroup) {
		if (!storiesStore.hasUnseen(group)) return 'bg-slate-200 dark:bg-dark-hover';
		return hasCloseFriends(group)
			? 'bg-green-500'
			: 'bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600';
	}

	const itemButton =
		'group w-18 flex flex-col items-center gap-1.5 cursor-pointer bg-transparent border-0 p-0 text-inherit rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 dark:focus-visible:outline-kizuna-blue active:scale-95 transition-transform';
</script>

<div
	class="stories-container w-full bg-white dark:bg-dark-card border-b lg:border border-slate-100 dark:border-dark-border rounded-none lg:rounded-2xl py-3 lg:p-4 mb-2 lg:mb-4 shadow-none lg:shadow-xs dark:shadow-none overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-px-4 {className}"
>
	<ul class="flex items-start gap-3 lg:gap-5 min-w-max px-4 lg:px-0 list-none m-0">
		<!-- Your story: watch it (ring) or add one (+) -->
		<li class="snap-start relative">
			{#if own}
				<button
					type="button"
					class={itemButton}
					onclick={() => openViewer(own)}
					aria-label="View your story"
				>
					<div class="size-16 rounded-full p-[2.5px] {ringClass(own)}">
						<div class="size-full rounded-full p-[2px] bg-white dark:bg-dark-card">
							<Avatar src={own.user.image} name={own.user.name} size="lg" class="!size-full" />
						</div>
					</div>
					<span
						class="w-full truncate text-center text-xs font-medium text-slate-700 dark:text-dark-muted leading-tight"
					>
						Your story
					</span>
				</button>
				<button
					type="button"
					class="absolute top-11 left-11 size-6 rounded-full bg-blue-600 dark:bg-kizuna-blue text-white flex items-center justify-center border-2 border-white dark:border-dark-card cursor-pointer p-0"
					onclick={addStory}
					aria-label="Add to your story"
				>
					<Icon name="plus" class="text-[10px]" />
				</button>
			{:else}
				<button type="button" class={itemButton} onclick={addStory} aria-label="Add your story">
					<div
						class="size-16 rounded-full border-1.5 border-dashed border-slate-300 dark:border-dark-border group-hover:border-slate-900 dark:group-hover:border-white flex items-center justify-center text-slate-500 dark:text-dark-muted group-hover:text-slate-900 dark:group-hover:text-white transition-all duration-150 bg-slate-50 dark:bg-dark-elevated"
					>
						<Icon name="plus" class="text-lg" />
					</div>
					<span
						class="w-full truncate text-center text-xs font-medium text-slate-700 dark:text-dark-muted leading-tight"
					>
						Your story
					</span>
				</button>
			{/if}
		</li>

		{#if !storiesStore.loaded}
			{#each [0, 1, 2, 3] as i (i)}
				<li class="w-18 flex flex-col items-center gap-1.5" aria-hidden="true">
					<div class="size-16 rounded-full bg-slate-100 dark:bg-dark-elevated animate-pulse"></div>
					<div
						class="h-2.5 w-12 rounded-full bg-slate-100 dark:bg-dark-elevated animate-pulse"
					></div>
				</li>
			{/each}
		{:else}
			<!-- People you follow: gradient ring = new, green = new incl. close friends, grey = watched -->
			{#each others as group (group.user.id)}
				{@const unseen = storiesStore.hasUnseen(group)}
				<li class="snap-start">
					<button
						type="button"
						class={itemButton}
						onclick={() => openViewer(group)}
						aria-label={`View story from ${group.user.name}${unseen ? ', new' : ''}${hasCloseFriends(group) ? ', close friends' : ''}`}
					>
						<div class="size-16 rounded-full p-[2.5px] {ringClass(group)}">
							<div class="size-full rounded-full p-[2px] bg-white dark:bg-dark-card">
								<Avatar
									src={group.user.image}
									name={group.user.name}
									size="lg"
									class="!size-full"
								/>
							</div>
						</div>
						<span
							class="w-full truncate text-center text-xs leading-tight {unseen
								? 'font-semibold text-slate-900 dark:text-dark-text'
								: 'font-medium text-slate-500 dark:text-dark-muted'}"
						>
							{group.user.handle ?? group.user.name}
						</span>
					</button>
				</li>
			{/each}
		{/if}
	</ul>
</div>

<StoryComposer bind:open={composerOpen} onShared={handleShared} />
<StoryViewer
	bind:open={viewerOpen}
	groups={viewerGroups}
	startIndex={viewerStart}
	onSeen={(story) => storiesStore.markSeen(story)}
	onDeleted={handleDeleted}
/>
