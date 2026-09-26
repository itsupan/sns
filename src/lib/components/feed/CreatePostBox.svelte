<script lang="ts">
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';
	import { OPEN_COMPOSER_EVENT } from '$lib/components/shared/nav-items';
	import { asset } from '$app/paths';
	import { authClient } from '$lib/auth-client';

	type PostType = 'photo' | 'story' | 'article';

	interface Props {
		onPublish?: (content: string, type: PostType) => void;
		class?: string;
	}

	let { onPublish, class: className = '' }: Props = $props();

	const session = authClient.useSession();

	let content = $state('');
	let selectedType = $state<PostType>('photo');
	let sheetOpen = $state(false);
	let inlineInput = $state<HTMLInputElement | null>(null);

	const types: { id: PostType; label: string; icon: string }[] = [
		{ id: 'photo', label: 'Photo', icon: 'picture' },
		{ id: 'story', label: 'Story', icon: 'play-alt' },
		{ id: 'article', label: 'Article', icon: 'document' }
	];

	let currentUser = $derived({
		name: $session.data?.user?.name || '',
		image: $session.data?.user?.image || null
	});

	let avatarSrc = $derived(currentUser.image || asset('/brand/logo-64.png'));

	function publish() {
		if (!content.trim()) return;
		onPublish?.(content.trim(), selectedType);
		content = '';
		sheetOpen = false;
	}

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		publish();
	}

	function openComposer() {
		if (window.matchMedia('(min-width: 640px)').matches) {
			inlineInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			inlineInput?.focus({ preventScroll: true });
		} else {
			sheetOpen = true;
		}
	}

	$effect(() => {
		window.addEventListener(OPEN_COMPOSER_EVENT, openComposer);
		return () => window.removeEventListener(OPEN_COMPOSER_EVENT, openComposer);
	});

	// Grow the textarea with its content, like a native composer.
	function autogrow(node: HTMLTextAreaElement) {
		const resize = () => {
			node.style.height = 'auto';
			node.style.height = `${node.scrollHeight}px`;
		};
		resize();
		node.addEventListener('input', resize);
		return { destroy: () => node.removeEventListener('input', resize) };
	}

	function chipClass(active: boolean) {
		return active
			? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 font-semibold'
			: 'bg-slate-100 text-slate-700 dark:bg-dark-elevated dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text';
	}
</script>

<!-- Mobile: compact pill that opens a bottom-sheet composer -->
<div
	class="sm:hidden w-full bg-white dark:bg-dark-card border-y border-slate-100 dark:border-dark-border px-4 py-3 mb-2 flex items-center gap-3 {className}"
>
	<Avatar src={avatarSrc} name={currentUser.name} size="md" />
	<button
		type="button"
		class="flex-1 h-11 px-4 text-left text-[15px] rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-500 dark:text-dark-subtle border-0 cursor-pointer active:bg-slate-200 dark:active:bg-dark-hover transition-colors"
		onclick={() => (sheetOpen = true)}
		aria-haspopup="dialog"
	>
		Share an observation…
	</button>
	<button
		type="button"
		class="size-11 rounded-full flex items-center justify-center text-slate-600 dark:text-dark-muted border-0 bg-transparent cursor-pointer active:scale-90 active:bg-slate-100 dark:active:bg-dark-hover transition"
		aria-label="Add photo"
		onclick={() => {
			selectedType = 'photo';
			sheetOpen = true;
		}}
	>
		<Icon name="picture" class="text-xl" />
	</button>
</div>

<BottomSheet bind:open={sheetOpen} title="Create post" showTitle>
	<form id="mobile-composer" onsubmit={handleSubmit} class="flex flex-col gap-4 px-3 pb-2">
		<div class="flex items-start gap-3">
			<Avatar src={avatarSrc} name={currentUser.name} size="md" />
			<textarea
				bind:value={content}
				use:autogrow
				rows="3"
				placeholder={selectedType === 'article'
					? 'Title on the first line, then your notes…'
					: 'Share an architectural observation, exhibition note…'}
				aria-label="Post content"
				enterkeyhint="enter"
				class="flex-1 min-h-24 max-h-[45dvh] resize-none bg-transparent border-0 p-0 pt-2 text-base leading-relaxed text-slate-900 dark:text-dark-text placeholder:text-slate-500 dark:placeholder:text-dark-subtle focus:outline-none"
			></textarea>
		</div>
		<div class="flex items-center gap-2" role="radiogroup" aria-label="Post type">
			{#each types as type (type.id)}
				<button
					type="button"
					role="radio"
					aria-checked={selectedType === type.id}
					class="flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium border-0 cursor-pointer active:scale-95 transition {chipClass(
						selectedType === type.id
					)}"
					onclick={() => (selectedType = type.id)}
				>
					<Icon name={type.icon} class="text-base" />
					<span>{type.label}</span>
				</button>
			{/each}
		</div>
	</form>

	{#snippet footer()}
		<button
			type="submit"
			form="mobile-composer"
			disabled={!content.trim()}
			class="w-full h-12 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-semibold text-[15px] border-0 cursor-pointer active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition"
		>
			Publish
		</button>
	{/snippet}
</BottomSheet>

<!-- Tablet / desktop: inline composer -->
<div
	id="create"
	class="create-post-card hidden sm:block w-full bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border rounded-2xl p-5 mb-5 shadow-xs dark:shadow-none {className}"
>
	<form onsubmit={handleSubmit} class="flex flex-col gap-3.5">
		<div class="flex items-center gap-3">
			<Avatar src={avatarSrc} name={currentUser.name} size="md" />
			<div class="flex-1">
				<input
					bind:this={inlineInput}
					type="text"
					bind:value={content}
					placeholder="Share an architectural observation, exhibition note..."
					aria-label="Post content"
					class="w-full h-11 px-4 text-sm bg-slate-100/80 dark:bg-dark-elevated text-slate-900 dark:text-dark-text placeholder:text-slate-500 dark:placeholder:text-dark-subtle rounded-full border-0 focus:outline-none focus:ring-1.5 focus:ring-slate-900 dark:focus:ring-white transition-all duration-150"
				/>
			</div>
		</div>

		<div class="flex items-center justify-between pt-1 flex-wrap gap-2">
			<div class="flex items-center gap-2" role="radiogroup" aria-label="Post type">
				{#each types as type (type.id)}
					<button
						type="button"
						role="radio"
						aria-checked={selectedType === type.id}
						class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer border-0 {chipClass(
							selectedType === type.id
						)}"
						onclick={() => (selectedType = type.id)}
					>
						<Icon name={type.icon} class="text-base" />
						<span>{type.label}</span>
					</button>
				{/each}
			</div>

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
