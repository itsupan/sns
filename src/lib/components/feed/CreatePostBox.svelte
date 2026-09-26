<script lang="ts">
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { asset } from '$app/paths';
	import { authClient } from '$lib/auth-client';

	interface Props {
		onPublish?: (content: string, type: 'photo' | 'story' | 'article') => void;
		class?: string;
	}

	let { onPublish, class: className = '' }: Props = $props();

	const session = authClient.useSession();

	let content = $state('');
	let selectedType = $state<'photo' | 'story' | 'article'>('photo');

	let currentUser = $derived({
		name: $session.data?.user?.name || 'Julian Vance',
		image: $session.data?.user?.image || null
	});

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!content.trim()) return;
		onPublish?.(content.trim(), selectedType);
		content = '';
	}
</script>

<div
	class="create-post-card w-full bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border rounded-2xl p-4 sm:p-5 mb-5 shadow-xs dark:shadow-none {className}"
>
	<form onsubmit={handleSubmit} class="flex flex-col gap-3.5">
		<!-- Top Row: Avatar + Input -->
		<div class="flex items-center gap-3">
			<Avatar
				src={currentUser.image || asset('/brand/kizuna_logo.png')}
				name={currentUser.name}
				size="md"
			/>
			<div class="flex-1">
				<input
					type="text"
					bind:value={content}
					placeholder="Share an architectural observation, exhibition note..."
					class="w-full h-11 px-4 text-sm bg-slate-100/80 dark:bg-dark-elevated text-slate-900 dark:text-dark-text placeholder:text-slate-400 dark:placeholder:text-dark-subtle rounded-full border-0 focus:outline-none focus:ring-1.5 focus:ring-slate-900 dark:focus:ring-white transition-all duration-150"
				/>
			</div>
		</div>

		<!-- Bottom Row: Media type triggers + Publish button -->
		<div class="flex items-center justify-between pt-1 flex-wrap gap-2">
			<!-- Action Buttons -->
			<div class="flex items-center gap-1 sm:gap-2">
				<button
					type="button"
					class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer border-0 bg-transparent {selectedType ===
					'photo'
						? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-dark-elevated font-semibold'
						: 'text-slate-600 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text hover:bg-slate-50 dark:hover:bg-dark-hover'}"
					onclick={() => (selectedType = 'photo')}
				>
					<Icon name="picture" class="text-base text-slate-500 dark:text-dark-muted" />
					<span>Photo</span>
				</button>

				<button
					type="button"
					class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer border-0 bg-transparent {selectedType ===
					'story'
						? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-dark-elevated font-semibold'
						: 'text-slate-600 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text hover:bg-slate-50 dark:hover:bg-dark-hover'}"
					onclick={() => (selectedType = 'story')}
				>
					<Icon name="play-alt" class="text-base text-slate-500 dark:text-dark-muted" />
					<span>Story</span>
				</button>

				<button
					type="button"
					class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer border-0 bg-transparent {selectedType ===
					'article'
						? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-dark-elevated font-semibold'
						: 'text-slate-600 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text hover:bg-slate-50 dark:hover:bg-dark-hover'}"
					onclick={() => (selectedType = 'article')}
				>
					<Icon name="document" class="text-base text-slate-500 dark:text-dark-muted" />
					<span>Article</span>
				</button>
			</div>

			<!-- Publish Button -->
			<button
				type="submit"
				disabled={!content.trim()}
				class="publish-btn bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-semibold text-xs px-5 py-2 rounded-full cursor-pointer hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 border-0 shadow-xs"
			>
				Publish
			</button>
		</div>
	</form>
</div>
