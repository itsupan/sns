<script lang="ts">
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { uploadToR2 } from '$lib/utils/upload';
	import { toast } from '$lib/utils/toast.svelte';
	import { readApiError } from '$lib/utils/api-error';
	import type { Story } from './stories.svelte';

	// Same limit as the server (MAX_STORY_CAPTION in $lib/server/stories).
	const MAX_STORY_CAPTION = 200;

	interface Props {
		open?: boolean;
		onShared?: (story: Story) => void;
	}

	let { open = $bindable(false), onShared }: Props = $props();

	let fileInput = $state<HTMLInputElement | null>(null);
	let previewUrl = $state<string | null>(null);
	let mediaType = $state<'image' | 'video'>('image');
	let mediaUrl = $state<string | null>(null);
	let progress = $state(0);
	let uploading = $state(false);
	let caption = $state('');
	let location = $state('');
	let sharing = $state(false);

	let canShare = $derived(Boolean(mediaUrl) && !uploading && !sharing);

	function reset() {
		if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
		previewUrl = null;
		mediaUrl = null;
		progress = 0;
		uploading = false;
		caption = '';
		location = '';
	}

	async function choose(file: File) {
		if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
			toast.show('Choose a photo or video');
			return;
		}
		reset();
		const isVideo = file.type.startsWith('video/');
		mediaType = isVideo ? 'video' : 'image';
		previewUrl = URL.createObjectURL(file);
		uploading = true;
		try {
			const result = await uploadToR2(file, {
				folder: 'stories',
				optimize: !isVideo,
				onProgress: (pct) => (progress = pct)
			});
			mediaUrl = result.publicUrl;
		} catch (err) {
			toast.show(err instanceof Error ? err.message : 'Upload failed');
			reset();
		} finally {
			uploading = false;
		}
	}

	function handleFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) choose(file);
	}

	async function share(e?: SubmitEvent) {
		e?.preventDefault();
		if (!canShare || !mediaUrl) return;
		sharing = true;
		try {
			const res = await fetch('/api/stories', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mediaUrl, mediaType, caption, location })
			});
			const body = (await res.json().catch(() => null)) as { story?: Story } | null;
			if (!res.ok || !body?.story) {
				toast.show(readApiError(body, 'Could not share your story').message);
				return;
			}
			onShared?.(body.story);
			toast.show('Story shared · visible for 24 hours');
			reset();
			open = false;
		} catch {
			toast.show('Could not share your story');
		} finally {
			sharing = false;
		}
	}
</script>

<input
	bind:this={fileInput}
	type="file"
	accept="image/*,video/*"
	class="hidden"
	onchange={handleFile}
	data-testid="story-file-input"
/>

<BottomSheet bind:open title="New story" showTitle onclose={reset}>
	<form id="story-composer" class="flex flex-col gap-4 px-3 pb-3" onsubmit={share}>
		<!-- 9:16 preview, same frame as the viewer -->
		<button
			type="button"
			class="relative mx-auto w-full max-w-60 aspect-9/16 rounded-2xl overflow-hidden bg-slate-100 dark:bg-dark-elevated border-2 border-dashed border-slate-200 dark:border-dark-border flex items-center justify-center cursor-pointer p-0 {previewUrl
				? 'border-transparent'
				: ''}"
			onclick={() => fileInput?.click()}
			aria-label={previewUrl ? 'Change story media' : 'Choose a photo or video'}
		>
			{#if previewUrl}
				{#if mediaType === 'video'}
					<video src={previewUrl} class="w-full h-full object-cover" muted playsinline autoplay loop
					></video>
				{:else}
					<img src={previewUrl} alt="Story preview" class="w-full h-full object-cover" />
				{/if}
				{#if uploading}
					<div
						class="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-2 text-white text-xs font-semibold"
					>
						<span>Uploading {progress}%</span>
						<span class="w-2/3 h-1 rounded-full bg-white/30 overflow-hidden">
							<span class="block h-full bg-white transition-all" style:width={`${progress}%`}
							></span>
						</span>
					</div>
				{:else}
					<span
						class="absolute bottom-2 right-2 px-2.5 py-1 rounded-full bg-black/60 text-white text-[11px] font-semibold"
					>
						Change
					</span>
				{/if}
			{:else}
				<span class="flex flex-col items-center gap-2 text-slate-500 dark:text-dark-muted">
					<Icon name="picture" class="text-3xl" />
					<span class="text-xs font-semibold">Choose a photo or video</span>
				</span>
			{/if}
		</button>

		<div class="flex flex-col gap-1.5">
			<div class="flex items-center justify-between text-xs text-slate-400">
				<span class="font-medium text-slate-600 dark:text-dark-muted">Caption</span>
				<span>{caption.length} / {MAX_STORY_CAPTION}</span>
			</div>
			<textarea
				bind:value={caption}
				rows="2"
				maxlength={MAX_STORY_CAPTION}
				placeholder="Say something about this moment…"
				aria-label="Story caption"
				class="w-full resize-none bg-slate-50 dark:bg-dark-elevated/40 rounded-2xl p-3 text-sm leading-relaxed text-slate-900 dark:text-dark-text placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-white"
			></textarea>
		</div>

		<div
			class="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-elevated/50 text-xs"
		>
			<Icon name="map-marker" class="text-sm text-slate-400" />
			<input
				type="text"
				bind:value={location}
				maxlength="100"
				placeholder="Location (optional)"
				aria-label="Story location"
				class="flex-1 bg-transparent border-0 text-slate-900 dark:text-dark-text placeholder:text-slate-400 focus:outline-none"
			/>
		</div>
	</form>

	{#snippet footer()}
		<div class="flex items-center gap-3 w-full">
			<button
				type="button"
				onclick={() => (open = false)}
				class="px-5 h-12 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-text font-semibold text-xs border-0 cursor-pointer"
			>
				Cancel
			</button>
			<button
				type="submit"
				form="story-composer"
				disabled={!canShare}
				class="flex-1 h-12 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-semibold text-sm border-0 cursor-pointer active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
			>
				<span>{sharing ? 'Sharing…' : 'Share to story'}</span>
				<Icon name="arrow-right" class="text-xs" />
			</button>
		</div>
	{/snippet}
</BottomSheet>
