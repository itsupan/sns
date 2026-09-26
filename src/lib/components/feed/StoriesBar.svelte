<script lang="ts">
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { toast } from '$lib/utils/toast.svelte';

	interface Story {
		id: string;
		username: string;
		avatar: string;
		hasUnread?: boolean;
		activeRing?: boolean | 'blue' | 'accent' | 'default';
	}

	interface Props {
		stories?: Story[];
		class?: string;
		onAddStory?: () => void;
		onSelectStory?: (story: Story) => void;
	}

	const defaultStories: Story[] = [
		{
			id: '1',
			username: 'elena.r',
			avatar:
				'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
			hasUnread: true,
			activeRing: 'default'
		},
		{
			id: '2',
			username: 'kai.raw',
			avatar:
				'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
			hasUnread: true,
			activeRing: 'default'
		},
		{
			id: '3',
			username: 'studio.aalto',
			avatar:
				'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=150&auto=format&fit=crop&q=80',
			hasUnread: true,
			activeRing: 'blue'
		},
		{
			id: '4',
			username: 'maya.zen',
			avatar:
				'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
			hasUnread: false,
			activeRing: 'default'
		},
		{
			id: '5',
			username: 'archv.lab',
			avatar:
				'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
			hasUnread: false,
			activeRing: 'default'
		},
		{
			id: '6',
			username: 'formvoid',
			avatar:
				'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150&auto=format&fit=crop&q=80',
			hasUnread: false,
			activeRing: 'default'
		}
	];

	let {
		stories = defaultStories,
		class: className = '',
		onAddStory,
		onSelectStory
	}: Props = $props();
</script>

<div
	class="stories-container w-full bg-white dark:bg-dark-card border-b sm:border border-slate-100 dark:border-dark-border rounded-none sm:rounded-2xl py-3 sm:p-4 mb-2 sm:mb-4 shadow-none sm:shadow-xs dark:shadow-none overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-px-4 {className}"
>
	<ul class="flex items-start gap-3 sm:gap-5 min-w-max px-4 sm:px-0 list-none m-0">
		<!-- Add your story button -->
		<li class="snap-start">
			<button
				type="button"
				class="group w-18 flex flex-col items-center gap-1.5 cursor-pointer bg-transparent border-0 p-0 text-inherit rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 dark:focus-visible:outline-kizuna-blue active:scale-95 transition-transform"
				onclick={onAddStory ?? (() => toast.show('Stories are coming soon'))}
				aria-label="Add your story"
			>
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
		</li>

		<!-- Creators' stories: gradient ring = unseen, grey ring = seen -->
		{#each stories as story (story.id)}
			<li class="snap-start">
				<button
					type="button"
					class="group w-18 flex flex-col items-center gap-1.5 cursor-pointer bg-transparent border-0 p-0 text-inherit rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 dark:focus-visible:outline-kizuna-blue active:scale-95 transition-transform"
					onclick={() =>
						onSelectStory ? onSelectStory(story) : toast.show('Stories are coming soon')}
					aria-label={`View story from ${story.username}${story.hasUnread ? ', new' : ''}`}
				>
					<div
						class="size-16 rounded-full p-[2.5px] {story.hasUnread
							? 'bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600'
							: 'bg-slate-200 dark:bg-dark-hover'}"
					>
						<div class="size-full rounded-full p-[2px] bg-white dark:bg-dark-card">
							<Avatar src={story.avatar} name={story.username} size="lg" class="!size-full" />
						</div>
					</div>
					<span
						class="w-full truncate text-center text-xs leading-tight {story.hasUnread
							? 'font-semibold text-slate-900 dark:text-dark-text'
							: 'font-medium text-slate-500 dark:text-dark-muted'}"
					>
						{story.username}
					</span>
				</button>
			</li>
		{/each}
	</ul>
</div>
