<script lang="ts">
	import { readApiError } from '$lib/utils/api-error';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';
	import { OPEN_COMPOSER_EVENT } from '$lib/components/shared/nav-items';
	import { asset } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import { toast } from '$lib/utils/toast.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PostData } from './PostCard.svelte';
	import PostComposerFields from './PostComposerFields.svelte';
	import {
		ASPECT_RATIOS as ratios,
		MAX_CONTENT_LENGTH,
		POST_TYPES as types,
		PostDraft
	} from './post-draft.svelte';

	export type { PostType, MediaPlate } from './post-draft.svelte';

	interface Props {
		onPublish?: (post: PostData) => void;
		class?: string;
	}

	let { onPublish, class: className = '' }: Props = $props();

	const session = authClient.useSession();

	const draft = new PostDraft();

	let sheetOpen = $state(false);
	let studioModalOpen = $state(false);
	let inlineInput = $state<HTMLTextAreaElement | null>(null);

	let fileInputDesktop = $state<HTMLInputElement | null>(null);
	let fileInputStudio = $state<HTMLInputElement | null>(null);

	let isSubmitting = $state(false);
	let isDragging = $state(false);

	let showLocationInput = $state(false);
	let showTagInput = $state(false);

	let currentUser = $derived({
		name: $session.data?.user?.name || '',
		image: $session.data?.user?.image || null
	});

	let avatarSrc = $derived(currentUser.image || asset('/brand/logo-64.png'));

	const isPublishDisabled = $derived(draft.isEmpty || isSubmitting || draft.isUploadingAny);

	const ratioClass = $derived.by(() => {
		if (draft.canvasRatio === '1:1') return 'aspect-square';
		if (draft.canvasRatio === '16:9') return 'aspect-video';
		return 'aspect-[4/5]';
	});

	/** Sends signed-out users to login; returns whether the user may continue. */
	function requireLogin(message: string): boolean {
		if ($session.data?.user) return true;
		toast.show(message);
		const currentPath =
			typeof window !== 'undefined'
				? window.location.pathname + window.location.search
				: resolve('/');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`${resolve('/login')}?redirectTo=${encodeURIComponent(currentPath)}`).catch(() => {
			// Router not mounted
		});
		return false;
	}

	function processFiles(files: FileList | File[]) {
		if (!requireLogin('Please log in to upload media')) return;
		draft.processFiles(files);
	}

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			processFiles(target.files);
		}
		target.value = '';
	}

	async function publish() {
		if (isPublishDisabled) return;
		if (!requireLogin('Please log in to publish a post')) return;

		isSubmitting = true;
		try {
			const res = await fetch('/api/posts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...draft.toPayload(), cameraMeta: null })
			});

			if (!res.ok) {
				const data = await res.json().catch(() => null);
				throw new Error(readApiError(data, 'Failed to publish post').message);
			}

			const data = (await res.json()) as { post: PostData };
			onPublish?.(data.post);
			toast.show('Post published successfully');

			draft.reset();
			showLocationInput = false;
			showTagInput = false;
			sheetOpen = false;
			studioModalOpen = false;
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Could not publish post';
			toast.show(message);
		} finally {
			isSubmitting = false;
		}
	}

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		publish();
	}

	function openComposer() {
		if (window.matchMedia('(min-width: 1024px)').matches) {
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

	function autogrow(node: HTMLTextAreaElement) {
		const resize = () => {
			node.style.height = 'auto';
			node.style.height = `${node.scrollHeight}px`;
		};
		resize();
		node.addEventListener('input', resize);
		return { destroy: () => node.removeEventListener('input', resize) };
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
			processFiles(e.dataTransfer.files);
		}
	}
</script>

<!-- Hidden Multi-file Inputs -->
<input
	bind:this={fileInputDesktop}
	type="file"
	multiple
	accept="image/*,video/*"
	class="hidden"
	onchange={handleFileSelect}
/>
<input
	bind:this={fileInputStudio}
	type="file"
	multiple
	accept="image/*,video/*"
	class="hidden"
	onchange={handleFileSelect}
/>

<!-- 1. MOBILE & VERTICAL TABLET FEED COMPACT BAR: Opens Mobile BottomSheet/Drawer -->
<div
	class="lg:hidden w-full bg-white dark:bg-dark-card border-y border-slate-100 dark:border-dark-border px-4 py-3 mb-2 flex items-center gap-3 {className}"
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
			draft.selectedType = 'photo';
			sheetOpen = true;
		}}
	>
		<Icon name="picture" class="text-xl" />
	</button>
</div>

<!-- 2. MOBILE BOTTOMSHEET COMPOSER (Matching Mockup 0) -->
<BottomSheet bind:open={sheetOpen} title="Create post" showTitle>
	<PostComposerFields
		{draft}
		id="mobile-composer"
		onsubmit={publish}
		beforeAddMedia={() => requireLogin('Please log in to upload media')}
	/>

	{#snippet footer()}
		<div class="flex items-center gap-3 w-full">
			<button
				type="button"
				onclick={() => {
					sheetOpen = false;
				}}
				class="px-5 h-12 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-text font-semibold text-xs border-0 cursor-pointer"
			>
				Cancel
			</button>
			<button
				type="submit"
				form="mobile-composer"
				disabled={isPublishDisabled}
				class="flex-1 h-12 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-semibold text-sm border-0 cursor-pointer active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
			>
				<span>{isSubmitting ? 'Publishing…' : 'Publish'}</span>
				<Icon name="arrow-right" class="text-xs" />
			</button>
		</div>
	{/snippet}
</BottomSheet>

<!-- 3. TABLET LANDSCAPE / DESKTOP: INLINE FEED COMPOSER -->
<div
	id="create"
	class="create-post-card hidden lg:block w-full bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border rounded-3xl p-4 xl:p-5 mb-6 shadow-xs dark:shadow-none transition-shadow duration-200 overflow-hidden {className}"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	role="region"
	aria-label="Create Post"
>
	<form onsubmit={handleSubmit} class="flex flex-col gap-3.5">
		{#if draft.selectedType === 'article'}
			<input
				type="text"
				bind:value={draft.title}
				placeholder="Article title..."
				class="w-full text-base sm:text-lg font-bold text-slate-950 dark:text-white bg-transparent border-b border-slate-100 dark:border-dark-border pb-2 focus:outline-none placeholder:text-slate-400"
			/>
		{/if}

		<div class="flex items-start gap-3.5">
			<Avatar src={avatarSrc} name={currentUser.name} size="md" />
			<div class="flex-1 flex flex-col gap-3">
				<textarea
					bind:this={inlineInput}
					bind:value={draft.content}
					use:autogrow
					rows="2"
					maxlength={MAX_CONTENT_LENGTH}
					placeholder="Share an architectural observation, exhibition note..."
					aria-label="Post content"
					class="w-full min-h-16 py-1 px-1 text-[15px] bg-transparent text-slate-900 dark:text-dark-text placeholder:text-slate-400 dark:placeholder:text-dark-subtle border-0 focus:outline-none transition-all duration-150 resize-none leading-relaxed"
				></textarea>

				<!-- Multiple Media Preview / Sequence Tray (Desktop) -->
				{#if draft.mediaPlates.length > 0}
					<div
						class="flex flex-col gap-3 p-3.5 bg-slate-50 dark:bg-dark-elevated/40 rounded-2xl border border-slate-100 dark:border-dark-border"
					>
						<!-- Contextual Ratio & Plate Counter Header -->
						<div class="flex items-center justify-between pb-1 text-xs">
							<div class="flex items-center gap-2">
								<span
									class="text-slate-500 dark:text-dark-muted font-medium flex items-center gap-1"
								>
									<Icon name="crop" class="text-xs" />
									<span>Canvas:</span>
								</span>
								<div
									class="inline-flex items-center p-0.5 rounded-lg bg-slate-200/60 dark:bg-dark-elevated text-[11px]"
								>
									{#each ratios as r (r.id)}
										<button
											type="button"
											onclick={() => (draft.canvasRatio = r.id)}
											class="px-2.5 py-0.5 rounded-md font-medium transition cursor-pointer border-0 {draft.canvasRatio ===
											r.id
												? 'bg-white dark:bg-dark-card text-slate-950 dark:text-white shadow-xs font-semibold'
												: 'text-slate-600 dark:text-dark-muted hover:text-slate-900 dark:hover:text-white'}"
											title={`Aspect ratio ${r.label} (${r.sub})`}
										>
											{r.label}
										</button>
									{/each}
								</div>
							</div>

							<div class="flex items-center gap-3">
								<span class="text-[11px] font-mono text-slate-400">
									Plate {draft.activePlateIndex + 1} of {draft.mediaPlates.length}
								</span>
								<button
									type="button"
									onclick={() => draft.removeAllMedia()}
									class="text-[11px] text-slate-400 hover:text-red-500 transition border-0 bg-transparent cursor-pointer"
								>
									Clear all
								</button>
							</div>
						</div>

						<!-- Active Plate Master Canvas Preview -->
						{#if draft.activePlate}
							<div
								class="relative w-full max-h-80 {ratioClass} rounded-2xl overflow-hidden bg-slate-950 mx-auto flex items-center justify-center shadow-inner"
							>
								{#if draft.activePlate.type === 'video'}
									<video
										src={draft.activePlate.previewUrl}
										controls
										playsinline
										preload="metadata"
										class="w-full h-full object-contain"
									>
										<source
											src={draft.activePlate.previewUrl}
											type={draft.activePlate.file?.type || 'video/mp4'}
										/>
										<track kind="captions" />
									</video>
								{:else}
									<img
										src={draft.activePlate.previewUrl}
										alt="Active plate"
										class="w-full h-full object-contain"
									/>
								{/if}

								<!-- Top Plate Indicator Badge -->
								<div
									class="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[11px] font-mono tracking-wider shadow-xs"
								>
									PLATE {String(draft.activePlateIndex + 1).padStart(2, '0')} OF {String(
										draft.mediaPlates.length
									).padStart(2, '0')}
								</div>

								<!-- Delete Active Plate Button -->
								<button
									type="button"
									onclick={() => draft.removePlate(draft.activePlate.id)}
									class="absolute top-3 right-3 size-8 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center text-sm transition cursor-pointer border-0 shadow-md active:scale-95"
									aria-label="Remove media"
								>
									✕
								</button>
							</div>
						{/if}

						<!-- Sequence Thumbnails -->
						<div class="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
							{#each draft.mediaPlates as plate, idx (plate.id)}
								<button
									type="button"
									onclick={() => (draft.activePlateIndex = idx)}
									class="group relative shrink-0 size-16 sm:size-20 rounded-xl overflow-hidden bg-slate-900 border-2 transition-all p-0 cursor-pointer {idx ===
									draft.activePlateIndex
										? 'border-slate-950 dark:border-white shadow-md'
										: 'border-transparent opacity-75 hover:opacity-100'}"
								>
									{#if plate.type === 'video'}
										<video
											src={plate.previewUrl}
											class="w-full h-full object-cover"
											muted
											playsinline
											preload="metadata"
										></video>
									{:else}
										<img
											src={plate.previewUrl}
											alt={`Plate ${idx + 1}`}
											class="w-full h-full object-cover"
										/>
									{/if}

									<div
										class="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-black/80 text-white text-[9px] font-mono"
									>
										{idx + 1}
									</div>

									{#if plate.uploading}
										<div
											class="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white text-[10px]"
										>
											{plate.progress}%
										</div>
									{/if}
								</button>
							{/each}

							<!-- Add Plate Button -->
							<button
								type="button"
								onclick={() => fileInputDesktop?.click()}
								class="shrink-0 size-16 sm:size-20 rounded-xl border-2 border-dashed border-slate-300 dark:border-dark-border flex flex-col items-center justify-center gap-1 text-slate-500 dark:text-dark-muted hover:border-slate-400 dark:hover:border-slate-600 transition bg-transparent cursor-pointer"
								title="Add another plate"
							>
								<Icon name="plus" class="text-base" />
								<span class="text-[10px] font-medium">Add</span>
							</button>
						</div>
					</div>
				{/if}

				<!-- Dropzone Banner when dragging files over -->
				{#if isDragging}
					<div
						class="w-full py-6 border-2 border-dashed border-slate-950 dark:border-white rounded-2xl bg-slate-100 dark:bg-dark-elevated flex flex-col items-center justify-center text-xs font-semibold text-slate-900 dark:text-white gap-1 animate-pulse"
					>
						<Icon name="upload" class="text-xl" />
						<span>Drop photos or videos to add as plates</span>
					</div>
				{/if}

				<!-- Optional Location Bar if active or has location -->
				{#if showLocationInput || draft.location}
					<div
						class="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-elevated/40 border border-slate-100 dark:border-dark-border text-xs"
					>
						<Icon name="map-marker" class="text-xs text-slate-400 shrink-0" />
						<input
							type="text"
							bind:value={draft.location}
							placeholder="Exhibition space or location (e.g. Fondazione Prada, Milano)"
							class="flex-1 bg-transparent border-0 text-xs text-slate-900 dark:text-dark-text placeholder:text-slate-400 focus:outline-none"
						/>
						<button
							type="button"
							onclick={() => {
								draft.location = '';
								showLocationInput = false;
							}}
							class="text-slate-400 hover:text-slate-700 dark:hover:text-white border-0 bg-transparent cursor-pointer p-0 text-xs shrink-0"
							title="Clear location"
						>
							✕
						</button>
					</div>
				{/if}

				<!-- Optional Tag Bar if active or has tags -->
				{#if showTagInput || draft.tags.length > 0}
					<div class="flex items-center gap-1.5 flex-wrap text-xs pt-0.5">
						{#each draft.tags as tag (tag)}
							<span
								class="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-text font-medium"
							>
								{tag}
								<button
									type="button"
									onclick={() => draft.removeTag(tag)}
									class="text-slate-400 hover:text-slate-700 dark:hover:text-white border-0 bg-transparent cursor-pointer p-0 text-xs leading-none"
									aria-label={`Remove tag ${tag}`}
								>
									×
								</button>
							</span>
						{/each}
						<div
							class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-dark-elevated/40 border border-slate-100 dark:border-dark-border text-xs"
						>
							<span class="text-slate-400 text-xs">#</span>
							<input
								type="text"
								bind:value={draft.tagInput}
								onkeydown={(e) => draft.handleTagKeydown(e)}
								placeholder="tag (Enter)"
								class="w-20 bg-transparent border-0 text-xs text-slate-900 dark:text-dark-text placeholder:text-slate-400 focus:outline-none"
							/>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Desktop Controls Toolbar (Single, clean row, never overlaps) -->
		<div
			class="flex flex-wrap items-center justify-between pt-3 gap-2 border-t border-slate-100 dark:border-dark-border/60"
		>
			<!-- Left: Creator modes & attachment icon buttons -->
			<div
				class="flex items-center gap-1.5 xl:gap-2 flex-wrap"
				role="radiogroup"
				aria-label="Post type"
			>
				<!-- Post type segmented control -->
				<div
					class="inline-flex items-center p-0.5 rounded-full bg-slate-100 dark:bg-dark-elevated text-xs font-medium"
				>
					{#each types as type (type.id)}
						<button
							type="button"
							role="radio"
							aria-checked={draft.selectedType === type.id}
							class="flex items-center gap-1 px-2 xl:px-2.5 py-1 rounded-full text-[11px] xl:text-xs font-medium transition cursor-pointer border-0 {draft.selectedType ===
							type.id
								? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-xs font-semibold'
								: 'text-slate-600 dark:text-dark-muted hover:text-slate-900 dark:hover:text-white'}"
							onclick={() => (draft.selectedType = type.id)}
						>
							<Icon name={type.icon} class="text-xs" />
							<span>{type.label}</span>
						</button>
					{/each}
				</div>

				<!-- Add Media Button -->
				<button
					type="button"
					onclick={() => fileInputDesktop?.click()}
					class="size-7 xl:size-8 rounded-full flex items-center justify-center text-slate-500 hover:text-blue-600 dark:text-dark-muted dark:hover:text-kizuna-blue hover:bg-slate-100 dark:hover:bg-dark-elevated transition border-0 bg-transparent cursor-pointer shrink-0"
					title="Attach Photos or Videos"
					aria-label="Add media"
				>
					<Icon name="picture" class="text-sm" />
				</button>

				<!-- Location Toggle Button -->
				<button
					type="button"
					onclick={() => (showLocationInput = !showLocationInput)}
					class="size-7 xl:size-8 rounded-full flex items-center justify-center transition border-0 cursor-pointer shrink-0 {showLocationInput ||
					draft.location
						? 'bg-slate-200 dark:bg-dark-elevated text-slate-900 dark:text-white'
						: 'text-slate-500 dark:text-dark-muted hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-elevated bg-transparent'}"
					title="Add spatial location"
					aria-label="Add location"
				>
					<Icon name="map-marker" class="text-xs" />
				</button>

				<!-- Tag Toggle Button -->
				<button
					type="button"
					onclick={() => (showTagInput = !showTagInput)}
					class="size-7 xl:size-8 rounded-full flex items-center justify-center transition border-0 cursor-pointer shrink-0 {showTagInput ||
					draft.tags.length > 0
						? 'bg-slate-200 dark:bg-dark-elevated text-slate-900 dark:text-white'
						: 'text-slate-500 dark:text-dark-muted hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-elevated bg-transparent'}"
					title="Add tags"
					aria-label="Add tags"
				>
					<Icon name="hashtag" class="text-xs" />
				</button>
			</div>

			<!-- Right: Counter, Studio Suite & Publish Action -->
			<div class="flex items-center gap-1.5 xl:gap-2 shrink-0">
				{#if draft.content.length > 0}
					<span class="text-[11px] font-mono text-slate-400 dark:text-dark-subtle mr-1">
						{draft.content.length}/{MAX_CONTENT_LENGTH}
					</span>
				{/if}

				<!-- Studio Creation Suite Modal Trigger -->
				<button
					type="button"
					onclick={() => (studioModalOpen = true)}
					class="size-7 xl:size-8 rounded-full flex items-center justify-center text-slate-400 dark:text-dark-muted hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-elevated transition border-0 bg-transparent cursor-pointer shrink-0"
					title="Open Studio Creation Suite"
					aria-label="Studio mode"
				>
					<Icon name="expand" class="text-xs" />
				</button>

				<!-- Primary Publish Button -->
				<button
					type="submit"
					disabled={isPublishDisabled}
					class="publish-btn bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-semibold text-xs px-4 xl:px-5 py-1.5 xl:py-2 rounded-full cursor-pointer hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 border-0 shadow-xs flex items-center gap-1.5 shrink-0"
				>
					<span>{isSubmitting ? 'Publishing…' : 'Publish'}</span>
					<Icon name="arrow-right" class="text-[10px]" />
				</button>
			</div>
		</div>
	</form>
</div>

<!-- 4. DESKTOP STUDIO CREATION SUITE MODAL (Mockup 1) -->
{#if studioModalOpen}
	<div
		class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
		aria-label="Studio Creation Suite"
	>
		<div
			class="relative w-full max-w-5xl bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
		>
			<!-- Studio Top Header -->
			<header
				class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-dark-border bg-slate-50/50 dark:bg-dark-elevated/40"
			>
				<div class="flex items-center gap-3">
					<span class="text-xs font-mono tracking-widest text-slate-400 uppercase">
						Studio Creation Suite
					</span>
					<span class="text-slate-300 dark:text-dark-border">/</span>
					<span class="text-sm font-semibold text-slate-900 dark:text-white">
						Curatorial Composition
					</span>
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => (studioModalOpen = false)}
						class="px-4 py-2 rounded-full text-xs font-semibold text-slate-600 dark:text-dark-muted hover:bg-slate-100 dark:hover:bg-dark-hover border-0 cursor-pointer transition"
					>
						Close
					</button>
					<button
						type="button"
						onclick={publish}
						disabled={isPublishDisabled}
						class="px-6 py-2 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-semibold text-xs border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5 shadow-xs"
					>
						<span>{isSubmitting ? 'Publishing…' : 'Publish Entry'}</span>
						<Icon name="arrow-right" class="text-xs" />
					</button>
				</div>
			</header>

			<!-- Studio 2-Column Grid (Mockup 1) -->
			<div class="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
				<!-- Left Column: Master Exhibit Canvas + Plates Sequence (col-span-7) -->
				<div class="lg:col-span-7 flex flex-col gap-4">
					<!-- Frame Standard Ratio Controls -->
					<div
						class="flex items-center justify-between p-2 rounded-2xl bg-slate-100 dark:bg-dark-elevated text-xs"
					>
						<span class="font-medium text-slate-600 dark:text-dark-muted px-2">Frame Standard</span>
						<div class="flex items-center gap-1">
							{#each ratios as r (r.id)}
								<button
									type="button"
									onclick={() => (draft.canvasRatio = r.id)}
									class="px-3 py-1.5 rounded-xl font-semibold transition border-0 cursor-pointer {draft.canvasRatio ===
									r.id
										? 'bg-white dark:bg-dark-card text-slate-950 dark:text-white shadow-xs'
										: 'text-slate-600 dark:text-dark-muted'}"
								>
									{r.label}
									{r.sub}
								</button>
							{/each}
						</div>
					</div>

					<!-- Master Canvas Preview -->
					<div
						class="relative w-full {ratioClass} max-h-[440px] rounded-3xl overflow-hidden bg-slate-950 flex items-center justify-center shadow-lg border border-slate-200 dark:border-dark-border"
					>
						{#if draft.activePlate}
							{#if draft.activePlate.type === 'video'}
								<video
									src={draft.activePlate.previewUrl}
									controls
									playsinline
									preload="metadata"
									class="w-full h-full object-contain"
								>
									<source
										src={draft.activePlate.previewUrl}
										type={draft.activePlate.file?.type || 'video/mp4'}
									/>
									<track kind="captions" />
								</video>
							{:else}
								<img
									src={draft.activePlate.previewUrl}
									alt="Active exhibition plate"
									class="w-full h-full object-contain"
								/>
							{/if}

							<div
								class="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[11px] font-mono tracking-wider shadow-sm"
							>
								PLATE {String(draft.activePlateIndex + 1).padStart(2, '0')} OF {String(
									draft.mediaPlates.length
								).padStart(2, '0')}
							</div>

							<button
								type="button"
								onclick={() => draft.removePlate(draft.activePlate.id)}
								class="absolute top-4 right-4 size-8 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center text-sm transition cursor-pointer border-0 shadow-md"
								aria-label="Remove plate"
							>
								✕
							</button>
						{:else}
							<div
								class="flex flex-col items-center justify-center text-slate-500 gap-2 p-6 text-center"
							>
								<Icon name="picture" class="text-4xl text-slate-600" />
								<span class="text-sm font-semibold text-slate-400">No media attached</span>
								<button
									type="button"
									onclick={() => fileInputStudio?.click()}
									class="px-5 py-2 rounded-full bg-white text-slate-950 font-semibold text-xs border-0 cursor-pointer mt-2"
								>
									Select Media Plates
								</button>
							</div>
						{/if}
					</div>

					<!-- Exhibition Sequence Tray -->
					<div class="flex flex-col gap-2">
						<div
							class="flex items-center justify-between text-xs text-slate-500 dark:text-dark-muted"
						>
							<span class="font-semibold text-slate-800 dark:text-dark-text">
								Exhibition Sequence ({draft.mediaPlates.length} Plates)
							</span>
							<span class="text-[11px]">Click plate to inspect</span>
						</div>

						<div class="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
							{#each draft.mediaPlates as plate, idx (plate.id)}
								<button
									type="button"
									onclick={() => (draft.activePlateIndex = idx)}
									class="group relative shrink-0 size-20 rounded-2xl overflow-hidden bg-slate-900 border-2 transition-all p-0 cursor-pointer {idx ===
									draft.activePlateIndex
										? 'border-slate-950 dark:border-white shadow-md'
										: 'border-transparent opacity-75 hover:opacity-100'}"
								>
									{#if plate.type === 'video'}
										<video
											src={plate.previewUrl}
											class="w-full h-full object-cover"
											muted
											playsinline
											preload="metadata"
										></video>
									{:else}
										<img
											src={plate.previewUrl}
											alt={`Plate ${idx + 1}`}
											class="w-full h-full object-cover"
										/>
									{/if}

									<div
										class="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-black/80 text-white text-[9px] font-mono"
									>
										{idx + 1}
									</div>

									{#if plate.uploading}
										<div
											class="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white text-[10px]"
										>
											{plate.progress}%
										</div>
									{/if}
								</button>
							{/each}

							<button
								type="button"
								onclick={() => fileInputStudio?.click()}
								class="shrink-0 size-20 rounded-2xl border-2 border-dashed border-slate-300 dark:border-dark-border flex flex-col items-center justify-center gap-1 text-slate-500 dark:text-dark-muted hover:border-slate-400 transition bg-transparent cursor-pointer"
								title="Add plate"
							>
								<Icon name="plus" class="text-base" />
								<span class="text-[10px] font-medium">Add Plate</span>
							</button>
						</div>
					</div>
				</div>

				<!-- Right Column: Curatorial Details & Metadata (col-span-5) -->
				<div class="lg:col-span-5 flex flex-col gap-4">
					<!-- Exhibition Title -->
					<div class="flex flex-col gap-1.5">
						<label
							for="studio-title"
							class="text-xs font-semibold text-slate-700 dark:text-dark-muted"
						>
							EXHIBITION TITLE
						</label>
						<input
							id="studio-title"
							type="text"
							bind:value={draft.title}
							placeholder="Monoliths of Silence: Structural Brutalism..."
							class="w-full px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-dark-elevated text-sm font-semibold text-slate-900 dark:text-dark-text border-0 focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-white"
						/>
					</div>

					<!-- Narrative Textarea -->
					<div class="flex flex-col gap-1.5">
						<div
							class="flex items-center justify-between text-xs text-slate-500 dark:text-dark-muted"
						>
							<label
								for="studio-narrative"
								class="font-semibold text-slate-700 dark:text-dark-muted"
							>
								CURATORIAL NARRATIVE
							</label>
							<span>{draft.content.length} / {MAX_CONTENT_LENGTH.toLocaleString()}</span>
						</div>
						<textarea
							id="studio-narrative"
							bind:value={draft.content}
							rows="5"
							maxlength={MAX_CONTENT_LENGTH}
							placeholder="Examining the monolithic concrete structures erected across during the late twentieth century..."
							class="w-full resize-none rounded-2xl p-4 text-sm leading-relaxed bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text placeholder:text-slate-400 border-0 focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-white"
						></textarea>
					</div>

					<!-- Spatial Location -->
					<div class="flex flex-col gap-1.5">
						<label
							for="studio-location"
							class="text-xs font-semibold text-slate-700 dark:text-dark-muted"
						>
							SPATIAL LOCATION / GALLERY CONTEXT
						</label>
						<div
							class="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-slate-100 dark:bg-dark-elevated text-sm text-slate-900 dark:text-dark-text"
						>
							<Icon name="map-marker" class="text-sm text-slate-400" />
							<input
								id="studio-location"
								type="text"
								bind:value={draft.location}
								placeholder="Fondazione Prada, Milano"
								class="flex-1 bg-transparent border-0 text-sm focus:outline-none text-slate-900 dark:text-dark-text"
							/>
						</div>
					</div>

					<!-- Tags -->
					<div class="flex flex-col gap-2">
						<span class="text-xs font-semibold text-slate-700 dark:text-dark-muted">
							CURATED DESCRIPTORS & TAGS
						</span>
						<div class="flex items-center gap-1.5 flex-wrap">
							{#each draft.tags as tag (tag)}
								<span
									class="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-semibold"
								>
									{tag}
									<button
										type="button"
										onclick={() => draft.removeTag(tag)}
										class="hover:opacity-75 border-0 bg-transparent text-white dark:text-slate-950 cursor-pointer p-0 ml-1"
									>
										✕
									</button>
								</span>
							{/each}
						</div>
						<div class="flex items-center gap-2">
							<input
								type="text"
								bind:value={draft.tagInput}
								onkeydown={(e) => draft.handleTagKeydown(e)}
								placeholder="#add-tag and press Enter"
								class="flex-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-dark-elevated text-xs text-slate-900 dark:text-dark-text border-0 focus:outline-none"
							/>
							<button
								type="button"
								onclick={() => draft.addTag()}
								class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-dark-hover text-xs font-semibold text-slate-800 dark:text-white border-0 cursor-pointer"
							>
								+ Add
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
