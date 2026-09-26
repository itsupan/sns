<script lang="ts">
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';

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
	class="stories-container w-full bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border rounded-2xl p-4 mb-4 shadow-xs dark:shadow-none overflow-x-auto no-scrollbar {className}"
>
	<div class="flex items-center gap-4 sm:gap-5 min-w-max">
		<!-- Add your story button -->
		<button
			type="button"
			class="group flex flex-col items-center gap-2 cursor-pointer bg-transparent border-0 p-0 text-inherit focus:outline-none"
			onclick={onAddStory}
			aria-label="Add your story"
		>
			<div
				class="size-14 rounded-full border-1.5 border-dashed border-slate-300 dark:border-dark-border group-hover:border-slate-900 dark:group-hover:border-white flex items-center justify-center text-slate-500 dark:text-dark-muted group-hover:text-slate-900 dark:group-hover:text-white transition-all duration-150 bg-slate-50 dark:bg-dark-elevated"
			>
				<Icon name="plus" class="text-base" />
			</div>
			<span class="text-xs font-medium text-slate-700 dark:text-dark-muted leading-tight">
				Your story
			</span>
		</button>

		<!-- Creators' stories -->
		{#each stories as story (story.id)}
			<button
				type="button"
				class="group flex flex-col items-center gap-2 cursor-pointer bg-transparent border-0 p-0 text-inherit focus:outline-none"
				onclick={() => onSelectStory?.(story)}
				aria-label={`View story from ${story.username}`}
			>
				<div class="relative transition-transform duration-150 group-hover:scale-105">
					<Avatar
						src={story.avatar}
						name={story.username}
						size="xl"
						ring={story.activeRing || 'default'}
					/>
				</div>
				<span
					class="text-xs font-medium text-slate-700 dark:text-dark-text leading-tight group-hover:text-slate-950 dark:group-hover:text-white transition-colors"
				>
					{story.username}
				</span>
			</button>
		{/each}
	</div>
</div>
