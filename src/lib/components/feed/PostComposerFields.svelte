<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import FormatToolbar from '$lib/components/shared/FormatToolbar.svelte';
	import MentionSuggest from '$lib/components/shared/MentionSuggest.svelte';
	import TextPostPicker from './TextPostPicker.svelte';
	import PollEditor from './PollEditor.svelte';
	import MediaAltFields from './MediaAltFields.svelte';
	import { formatShortcuts } from '$lib/formatting-editor';
	import { ASPECT_RATIOS, POST_TYPES, type PostDraft } from './post-draft.svelte';

	interface Props {
		draft: PostDraft;
		/** Form id so a sheet footer button can submit it. */
		id: string;
		onsubmit: () => void;
		/** Show the title field for every post type (edit form, when the post already has one). */
		alwaysShowTitle?: boolean;
		/** Offer a poll on text posts (new posts only: a poll cannot be edited). */
		allowPoll?: boolean;
		/** Called before opening the file picker; return false to block (e.g. signed out). */
		beforeAddMedia?: () => boolean;
		/** Shown under the text, e.g. the post being quoted. */
		attachment?: Snippet;
	}

	let {
		draft,
		id,
		onsubmit,
		alwaysShowTitle = false,
		allowPoll = false,
		beforeAddMedia,
		attachment
	}: Props = $props();

	let fileInput = $state<HTMLInputElement | null>(null);
	let contentInput = $state<HTMLTextAreaElement | null>(null);

	function openPicker() {
		if (beforeAddMedia && !beforeAddMedia()) return;
		fileInput?.click();
	}

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) draft.processFiles(target.files);
		target.value = '';
	}

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		onsubmit();
	}

	function autogrow(node: HTMLTextAreaElement) {
		const resize = () => {
			node.style.height = 'auto';
			node.style.height = `${node.scrollHeight}px`;
		};
		resize();
		node.addEventListener('input', resize);
		return { destroy: () => node.removeEventListener('input', resize) };
	}
</script>

<input
	bind:this={fileInput}
	type="file"
	multiple
	accept="image/*,video/*"
	class="hidden"
	onchange={handleFileSelect}
/>

<form {id} onsubmit={handleSubmit} class="flex flex-col gap-4 px-3 pb-3">
	<!-- Mode Switcher Tabs (Photo / Essay / Motion) -->
	<div
		class="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-dark-elevated rounded-2xl"
		role="radiogroup"
		aria-label="Post type"
	>
		{#each POST_TYPES as type (type.id)}
			<button
				type="button"
				role="radio"
				aria-checked={draft.selectedType === type.id}
				class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition border-0 cursor-pointer {draft.selectedType ===
				type.id
					? 'bg-white dark:bg-dark-card text-slate-950 dark:text-white shadow-xs'
					: 'text-slate-600 dark:text-dark-muted'}"
				onclick={() => (draft.selectedType = type.id)}
			>
				<Icon name={type.icon} class="text-xs" />
				<span>{type.label.split('/')[0].trim()}</span>
			</button>
		{/each}
	</div>

	{#if draft.isText}
		<TextPostPicker {draft} />
		{#if allowPoll}
			<PollEditor {draft} />
		{/if}
	{/if}

	<!-- Multiple Media Sequence Tray (Mockup 0) -->
	{#if !draft.isText && draft.mediaPlates.length > 0}
		<div class="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
			{#each draft.mediaPlates as plate, idx (plate.id)}
				<div
					class="relative shrink-0 w-28 aspect-[4/5] rounded-2xl overflow-hidden bg-slate-900 border-2 transition-all {idx ===
					draft.activePlateIndex
						? 'border-slate-950 dark:border-white shadow-sm'
						: 'border-transparent opacity-85'}"
				>
					<!-- Plate Thumbnail -->
					{#if plate.type === 'video'}
						<video
							src={plate.previewUrl}
							class="w-full h-full object-cover"
							muted
							playsinline
							preload="metadata"
						></video>
					{:else}
						<img src={plate.previewUrl} alt="Plate preview" class="w-full h-full object-cover" />
					{/if}

					<!-- Delete Button -->
					<button
						type="button"
						onclick={() => draft.removePlate(plate.id)}
						class="absolute top-1.5 right-1.5 size-6 rounded-full bg-black/75 text-white flex items-center justify-center text-xs border-0 cursor-pointer shadow-sm active:scale-90"
						aria-label="Remove plate"
					>
						✕
					</button>

					<!-- Plate Index Badge -->
					<div
						class="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-xs text-white text-[10px] font-semibold"
					>
						{idx === 0
							? `Primary · 1/${draft.mediaPlates.length}`
							: `${idx + 1}/${draft.mediaPlates.length}`}
					</div>

					<!-- Upload Progress Overlay -->
					{#if plate.uploading}
						<div
							class="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white text-[11px]"
						>
							<span>{plate.progress}%</span>
						</div>
					{/if}
				</div>
			{/each}

			<!-- Add Plate Button -->
			<button
				type="button"
				onclick={() => openPicker()}
				class="shrink-0 w-24 aspect-[4/5] rounded-2xl border-2 border-dashed border-slate-200 dark:border-dark-border flex flex-col items-center justify-center gap-1 text-slate-500 dark:text-dark-muted bg-transparent cursor-pointer active:scale-95 transition"
			>
				<Icon name="plus" class="text-lg" />
				<span class="text-[11px] font-medium">Add Plate</span>
			</button>
		</div>
	{/if}

	{#if !draft.isText}
		<MediaAltFields {draft} />
	{/if}

	<!-- Canvas Ratio Selector (Only when media attached) -->
	{#if !draft.isText && draft.mediaPlates.length > 0}
		<div
			class="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-dark-elevated/60 rounded-2xl text-xs"
		>
			<div class="flex items-center gap-2 text-slate-600 dark:text-dark-muted font-medium">
				<Icon name="crop" class="text-sm" />
				<span>Canvas Ratio</span>
			</div>
			<div class="flex items-center gap-1">
				{#each ASPECT_RATIOS as r (r.id)}
					<button
						type="button"
						onclick={() => (draft.canvasRatio = r.id)}
						class="px-2.5 py-1 rounded-xl text-xs font-semibold transition border-0 cursor-pointer {draft.canvasRatio ===
						r.id
							? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-xs'
							: 'bg-white dark:bg-dark-card text-slate-600 dark:text-dark-muted'}"
					>
						{r.label}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if draft.selectedType === 'article' || alwaysShowTitle}
		<input
			type="text"
			bind:value={draft.title}
			placeholder="Article title..."
			class="w-full text-base font-bold text-slate-950 dark:text-white bg-transparent border-b border-slate-200 dark:border-dark-border pb-2 focus:outline-none"
		/>
	{/if}

	<!-- Caption & Intent Textarea with Character Counter -->
	<div class="flex flex-col gap-1.5">
		<div class="flex items-center justify-between text-xs text-slate-400">
			<span class="font-medium text-slate-600 dark:text-dark-muted">Caption & Intent</span>
			<span>{draft.content.length} / {draft.maxLength.toLocaleString()}</span>
		</div>
		<FormatToolbar target={contentInput} class="mb-1" />
		<textarea
			bind:this={contentInput}
			bind:value={draft.content}
			use:autogrow
			use:formatShortcuts
			rows="3"
			maxlength={draft.maxLength}
			placeholder="Share an architectural observation, exhibition note..."
			aria-label="Post content"
			enterkeyhint="enter"
			class="w-full min-h-24 max-h-[30dvh] resize-none bg-slate-50 dark:bg-dark-elevated/40 rounded-2xl p-3 text-sm leading-relaxed text-slate-900 dark:text-dark-text placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-white"
		></textarea>
		<MentionSuggest target={contentInput} />
	</div>

	{@render attachment?.()}

	<!-- Interactive Tags List -->
	{#if draft.tags.length > 0}
		<div class="flex items-center gap-1.5 flex-wrap">
			{#each draft.tags as tag (tag)}
				<span
					class="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-800 dark:text-dark-text font-medium"
				>
					{tag}
					<button
						type="button"
						onclick={() => draft.removeTag(tag)}
						class="text-slate-400 hover:text-slate-700 dark:hover:text-white border-0 bg-transparent cursor-pointer p-0"
					>
						×
					</button>
				</span>
			{/each}
		</div>
	{/if}

	<!-- Spatial Location & Metadata Inputs -->
	<div class="flex flex-col gap-2 pt-1 border-t border-slate-100 dark:border-dark-border">
		<div
			class="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-elevated/50 text-xs"
		>
			<Icon name="map-marker" class="text-sm text-slate-400" />
			<input
				type="text"
				bind:value={draft.location}
				placeholder="Exhibition Space / Location (e.g. Fondazione Prada)"
				class="flex-1 bg-transparent border-0 text-slate-900 dark:text-dark-text placeholder:text-slate-400 focus:outline-none"
			/>
		</div>

		<div class="flex items-center gap-2">
			{#if !draft.isText}
				<button
					type="button"
					onclick={() => openPicker()}
					class="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-slate-100 dark:bg-dark-elevated text-xs font-semibold text-slate-700 dark:text-dark-text border-0 cursor-pointer active:scale-95 transition"
				>
					<Icon name="picture" class="text-sm text-blue-600 dark:text-kizuna-blue" />
					<span>{draft.mediaPlates.length > 0 ? 'Add more stills' : 'Attach Stills / Media'}</span>
				</button>
			{/if}

			<input
				type="text"
				bind:value={draft.tagInput}
				onkeydown={(e) => draft.handleTagKeydown(e)}
				placeholder="#tag (Enter)"
				class="w-32 h-10 px-3 text-xs bg-slate-100/70 dark:bg-dark-elevated text-slate-800 dark:text-dark-text placeholder:text-slate-400 rounded-xl border-0 focus:outline-none"
			/>
		</div>
	</div>
</form>
