<script lang="ts">
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { toast } from '$lib/utils/toast.svelte';
	import { uploadToR2 } from '$lib/utils/upload';

	interface Props {
		/** The avatar URL; `''` for none. */
		url?: string;
		/** Whose avatar it is, for the initials fallback. */
		name: string;
		uploading?: boolean;
	}

	let { url = $bindable(''), name, uploading = $bindable(false) }: Props = $props();

	let uploadProgress = $state(0);
	let uploadError = $state<string | null>(null);
	let fileInputRef = $state<HTMLInputElement | null>(null);

	function triggerFileInput() {
		fileInputRef?.click();
	}

	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		uploadError = null;
		uploading = true;
		uploadProgress = 0;

		try {
			// Perform direct pre-signed PUT upload to Cloudflare R2
			const result = await uploadToR2(file, {
				maxSizeMb: 10,
				allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
				onProgress: (percent) => {
					uploadProgress = percent;
				}
			});

			url = result.publicUrl;
			toast.show('Avatar uploaded successfully');
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to upload image';
			uploadError = message;
			toast.show(message);
		} finally {
			uploading = false;
			// Reset input value so re-selecting same file triggers change
			target.value = '';
		}
	}

	function removeAvatar() {
		url = '';
		uploadError = null;
	}
</script>

<div class="flex flex-col sm:flex-row items-center sm:items-start gap-5">
	<div class="relative group shrink-0">
		<Avatar
			src={url || ''}
			name={name || 'User'}
			size="lg"
			class="size-24 sm:size-28 ring-4 ring-slate-100 dark:ring-dark-elevated shadow-sm"
		/>

		<button
			type="button"
			onclick={triggerFileInput}
			disabled={uploading}
			class="absolute -bottom-1 -right-1 size-8 rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-950 flex items-center justify-center shadow-md border-2 border-white dark:border-dark-card hover:scale-105 active:scale-95 transition cursor-pointer disabled:opacity-50"
			aria-label="Upload new avatar"
			title="Upload avatar"
		>
			<Icon name="camera" class="text-xs" />
		</button>
	</div>

	<div class="flex flex-col items-center sm:items-start flex-1 gap-2 text-center sm:text-left">
		<div class="flex items-center gap-2.5 flex-wrap justify-center sm:justify-start">
			<button
				type="button"
				onclick={triggerFileInput}
				disabled={uploading}
				class="h-9 px-4 rounded-full text-xs font-semibold bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text hover:bg-slate-200 dark:hover:bg-dark-hover transition-colors cursor-pointer border-0 disabled:opacity-50 inline-flex items-center gap-1.5"
			>
				<Icon name="upload" class="text-xs" />
				<span>{uploading ? 'Uploading...' : 'Change Photo'}</span>
			</button>

			{#if url}
				<button
					type="button"
					onclick={removeAvatar}
					disabled={uploading}
					class="h-9 px-3.5 rounded-full text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer border-0 disabled:opacity-50"
				>
					Remove
				</button>
			{/if}
		</div>

		<p class="text-[11px] sm:text-xs text-slate-500 dark:text-dark-muted m-0">
			JPG, PNG, WEBP or GIF up to 10MB. Uploads directly to Cloudflare R2 storage.
		</p>

		<!-- Upload Progress Bar -->
		{#if uploading}
			<div class="w-full max-w-xs flex flex-col gap-1 mt-1">
				<div class="w-full h-1.5 bg-slate-100 dark:bg-dark-elevated rounded-full overflow-hidden">
					<div
						class="h-full bg-slate-950 dark:bg-white rounded-full transition-all duration-150"
						style="width: {uploadProgress}%"
					></div>
				</div>
				<span class="text-[10px] text-slate-500 dark:text-dark-muted font-medium">
					Uploading {uploadProgress}%
				</span>
			</div>
		{/if}

		<!-- Upload Error Message -->
		{#if uploadError}
			<span class="text-xs text-red-600 dark:text-red-400 font-medium">
				{uploadError}
			</span>
		{/if}

		<!-- Hidden Native File Input -->
		<input
			type="file"
			bind:this={fileInputRef}
			onchange={handleFileSelect}
			accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
			class="hidden"
			aria-label="Avatar file input"
		/>
	</div>
</div>
