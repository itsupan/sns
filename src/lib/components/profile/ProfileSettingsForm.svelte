<script lang="ts">
	import Icon from '$lib/components/shared/Icon.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import { toast } from '$lib/utils/toast.svelte';
	import { uploadToR2 } from '$lib/utils/upload';
	import { authClient } from '$lib/auth-client';

	export interface UserProfileData {
		id: string;
		name: string;
		email?: string;
		handle?: string | null;
		image?: string | null;
		bio?: string | null;
		title?: string | null;
		website?: string | null;
		location?: string | null;
		cameraGear?: string | null;
	}

	interface Props {
		initialData?: Partial<UserProfileData>;
		userId?: string;
		onSuccess?: (user: UserProfileData) => void;
		onCancel?: () => void;
		class?: string;
	}

	let {
		initialData = {},
		userId: explicitUserId,
		onSuccess,
		onCancel,
		class: className = ''
	}: Props = $props();

	const session = authClient.useSession();

	const currentUserId = $derived(
		explicitUserId ||
			initialData.id ||
			($session.data?.user as { id?: string } | undefined)?.id ||
			''
	);

	// Form field states
	let name = $state('');
	let handle = $state('');
	let title = $state('');
	let bio = $state('');
	let website = $state('');
	let location = $state('');
	let cameraGear = $state('');
	let avatarUrl = $state('');

	let initialized = $state(false);

	$effect(() => {
		if (!initialized) {
			name = initialData.name ?? ($session.data?.user as { name?: string } | undefined)?.name ?? '';
			handle =
				initialData.handle ??
				($session.data?.user as { handle?: string } | undefined)?.handle ??
				'';
			title =
				initialData.title ?? ($session.data?.user as { title?: string } | undefined)?.title ?? '';
			bio = initialData.bio ?? ($session.data?.user as { bio?: string } | undefined)?.bio ?? '';
			website =
				initialData.website ??
				($session.data?.user as { website?: string } | undefined)?.website ??
				'';
			location =
				initialData.location ??
				($session.data?.user as { location?: string } | undefined)?.location ??
				'';
			cameraGear =
				initialData.cameraGear ??
				($session.data?.user as { cameraGear?: string } | undefined)?.cameraGear ??
				'';
			avatarUrl =
				initialData.image ??
				($session.data?.user as { image?: string | null } | undefined)?.image ??
				'';
			initialized = true;
		}
	});

	// Initial snapshot to track pristine/dirty state
	let initialSnapshot = $derived({
		name: initialData.name ?? ($session.data?.user as { name?: string } | undefined)?.name ?? '',
		handle:
			initialData.handle ?? ($session.data?.user as { handle?: string } | undefined)?.handle ?? '',
		title:
			initialData.title ?? ($session.data?.user as { title?: string } | undefined)?.title ?? '',
		bio: initialData.bio ?? ($session.data?.user as { bio?: string } | undefined)?.bio ?? '',
		website:
			initialData.website ??
			($session.data?.user as { website?: string } | undefined)?.website ??
			'',
		location:
			initialData.location ??
			($session.data?.user as { location?: string } | undefined)?.location ??
			'',
		cameraGear:
			initialData.cameraGear ??
			($session.data?.user as { cameraGear?: string } | undefined)?.cameraGear ??
			'',
		avatarUrl:
			initialData.image ??
			($session.data?.user as { image?: string | null } | undefined)?.image ??
			''
	});

	// UI & upload states
	let isUploading = $state(false);
	let uploadProgress = $state(0);
	let uploadError = $state<string | null>(null);
	let fileInputRef = $state<HTMLInputElement | null>(null);

	let isSubmitting = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});

	// Derived dirty state
	let isDirty = $derived(
		name !== initialSnapshot.name ||
			handle !== initialSnapshot.handle ||
			title !== initialSnapshot.title ||
			bio !== initialSnapshot.bio ||
			website !== initialSnapshot.website ||
			location !== initialSnapshot.location ||
			cameraGear !== initialSnapshot.cameraGear ||
			avatarUrl !== initialSnapshot.avatarUrl
	);

	function triggerFileInput() {
		fileInputRef?.click();
	}

	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		uploadError = null;
		isUploading = true;
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

			avatarUrl = result.publicUrl;
			toast.show('Avatar uploaded successfully');
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to upload image';
			uploadError = message;
			toast.show(message);
		} finally {
			isUploading = false;
			// Reset input value so re-selecting same file triggers change
			target.value = '';
		}
	}

	function removeAvatar() {
		avatarUrl = '';
		uploadError = null;
	}

	function validate(): boolean {
		const errors: Record<string, string> = {};

		if (!name.trim()) {
			errors.name = 'Name is required';
		} else if (name.trim().length > 100) {
			errors.name = 'Name cannot exceed 100 characters';
		}

		if (handle.trim()) {
			const cleanHandle = handle.trim().replace(/^@/, '');
			if (!/^[a-z0-9_.-]{1,30}$/i.test(cleanHandle)) {
				errors.handle =
					'Handle can only contain letters, numbers, dots, and underscores (1-30 chars)';
			}
		}

		if (bio && bio.length > 500) {
			errors.bio = 'Bio cannot exceed 500 characters';
		}

		if (title && title.length > 100) {
			errors.title = 'Title cannot exceed 100 characters';
		}

		if (website && website.length > 255) {
			errors.website = 'Website URL cannot exceed 255 characters';
		}

		if (location && location.length > 100) {
			errors.location = 'Location cannot exceed 100 characters';
		}

		if (cameraGear && cameraGear.length > 200) {
			errors.cameraGear = 'Camera gear cannot exceed 200 characters';
		}

		fieldErrors = errors;
		return Object.keys(errors).length === 0;
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		formError = null;
		fieldErrors = {};

		if (!currentUserId) {
			formError = 'User ID could not be identified. Please make sure you are logged in.';
			return;
		}

		if (!validate()) {
			return;
		}

		isSubmitting = true;

		try {
			const payload = {
				name: name.trim(),
				handle: handle.trim() ? handle.trim().replace(/^@/, '') : null,
				title: title.trim() || null,
				bio: bio.trim() || null,
				website: website.trim() || null,
				location: location.trim() || null,
				cameraGear: cameraGear.trim() || null,
				image: avatarUrl.trim() || null
			};

			const response = await fetch(`/api/users/${encodeURIComponent(currentUserId)}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			const data = (await response.json()) as {
				field?: string;
				error?: string;
				user?: UserProfileData;
			};

			if (!response.ok) {
				if (response.status === 409 && data.field) {
					fieldErrors = { [data.field]: data.error || 'This handle is already taken' };
				} else {
					formError = data.error || 'Failed to update profile';
				}
				toast.show(data.error || 'Failed to update profile');
				return;
			}

			toast.show('Profile updated successfully');
			if (data.user) {
				onSuccess?.(data.user);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Network error updating profile';
			formError = message;
			toast.show(message);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<form
	class="w-full max-w-2xl mx-auto flex flex-col gap-6 {className}"
	onsubmit={handleSubmit}
	aria-label="Profile settings form"
>
	<!-- Card Container -->
	<div
		class="w-full bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border rounded-3xl p-5 sm:p-8 shadow-xs flex flex-col gap-6"
	>
		<!-- Header -->
		<div class="border-b border-slate-100 dark:border-dark-border pb-5">
			<h2
				class="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 dark:text-dark-text m-0"
			>
				Edit Profile
			</h2>
			<p class="text-xs sm:text-sm text-slate-500 dark:text-dark-muted mt-1 m-0">
				Update your public profile, avatar, and personal details.
			</p>
		</div>

		<!-- Error Alert Banner -->
		{#if formError}
			<div
				class="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-start gap-3 text-red-700 dark:text-red-400 text-sm"
				role="alert"
			>
				<Icon name="exclamation" class="text-base shrink-0 mt-0.5" />
				<div class="flex-1 font-medium">{formError}</div>
			</div>
		{/if}

		<!-- Avatar Upload Section -->
		<div class="flex flex-col sm:flex-row items-center sm:items-start gap-5">
			<div class="relative group shrink-0">
				<Avatar
					src={avatarUrl || ''}
					name={name || 'User'}
					size="lg"
					class="size-24 sm:size-28 ring-4 ring-slate-100 dark:ring-dark-elevated shadow-sm"
				/>

				<button
					type="button"
					onclick={triggerFileInput}
					disabled={isUploading}
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
						disabled={isUploading}
						class="h-9 px-4 rounded-full text-xs font-semibold bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text hover:bg-slate-200 dark:hover:bg-dark-hover transition-colors cursor-pointer border-0 disabled:opacity-50 inline-flex items-center gap-1.5"
					>
						<Icon name="upload" class="text-xs" />
						<span>{isUploading ? 'Uploading...' : 'Change Photo'}</span>
					</button>

					{#if avatarUrl}
						<button
							type="button"
							onclick={removeAvatar}
							disabled={isUploading}
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
				{#if isUploading}
					<div class="w-full max-w-xs flex flex-col gap-1 mt-1">
						<div
							class="w-full h-1.5 bg-slate-100 dark:bg-dark-elevated rounded-full overflow-hidden"
						>
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

		<!-- Form Fields Grid -->
		<div class="flex flex-col gap-4">
			<!-- Name Field -->
			<div class="flex flex-col gap-1.5">
				<label
					for="profile-name"
					class="text-xs font-semibold text-slate-900 dark:text-dark-text tracking-wide"
				>
					Display Name <span class="text-red-500">*</span>
				</label>
				<input
					id="profile-name"
					type="text"
					bind:value={name}
					required
					placeholder="e.g. Elena Rostova"
					maxlength="100"
					class="w-full h-11 px-3.5 text-sm bg-slate-50 dark:bg-dark-elevated text-slate-950 dark:text-dark-text rounded-xl border {fieldErrors.name
						? 'border-red-500 focus:ring-red-500'
						: 'border-slate-200 dark:border-dark-border focus:ring-slate-950 dark:focus:ring-white'} focus:outline-none focus:ring-1.5 transition-colors placeholder:text-slate-400 dark:placeholder:text-dark-subtle"
				/>
				{#if fieldErrors.name}
					<span class="text-xs text-red-600 dark:text-red-400 font-medium">
						{fieldErrors.name}
					</span>
				{/if}
			</div>

			<!-- Handle (Username) Field -->
			<div class="flex flex-col gap-1.5">
				<label
					for="profile-handle"
					class="text-xs font-semibold text-slate-900 dark:text-dark-text tracking-wide"
				>
					Username / Handle
				</label>
				<div class="relative flex items-center">
					<span
						class="absolute left-3.5 text-slate-400 dark:text-dark-muted font-medium text-sm select-none pointer-events-none"
					>
						@
					</span>
					<input
						id="profile-handle"
						type="text"
						bind:value={handle}
						placeholder="elena.rostova"
						maxlength="30"
						class="w-full h-11 pl-8 pr-3.5 text-sm bg-slate-50 dark:bg-dark-elevated text-slate-950 dark:text-dark-text rounded-xl border {fieldErrors.handle
							? 'border-red-500 focus:ring-red-500'
							: 'border-slate-200 dark:border-dark-border focus:ring-slate-950 dark:focus:ring-white'} focus:outline-none focus:ring-1.5 transition-colors placeholder:text-slate-400 dark:placeholder:text-dark-subtle"
					/>
				</div>
				{#if fieldErrors.handle}
					<span class="text-xs text-red-600 dark:text-red-400 font-medium">
						{fieldErrors.handle}
					</span>
				{:else}
					<span class="text-[11px] text-slate-500 dark:text-dark-muted">
						Your unique handle for mentions and profile links.
					</span>
				{/if}
			</div>

			<!-- Title / Profession Field -->
			<div class="flex flex-col gap-1.5">
				<label
					for="profile-title"
					class="text-xs font-semibold text-slate-900 dark:text-dark-text tracking-wide"
				>
					Title / Profession
				</label>
				<input
					id="profile-title"
					type="text"
					bind:value={title}
					placeholder="e.g. Architectural & Film Photographer"
					maxlength="100"
					class="w-full h-11 px-3.5 text-sm bg-slate-50 dark:bg-dark-elevated text-slate-950 dark:text-dark-text rounded-xl border {fieldErrors.title
						? 'border-red-500 focus:ring-red-500'
						: 'border-slate-200 dark:border-dark-border focus:ring-slate-950 dark:focus:ring-white'} focus:outline-none focus:ring-1.5 transition-colors placeholder:text-slate-400 dark:placeholder:text-dark-subtle"
				/>
				{#if fieldErrors.title}
					<span class="text-xs text-red-600 dark:text-red-400 font-medium">
						{fieldErrors.title}
					</span>
				{/if}
			</div>

			<!-- Bio Field -->
			<div class="flex flex-col gap-1.5">
				<div class="flex items-center justify-between">
					<label
						for="profile-bio"
						class="text-xs font-semibold text-slate-900 dark:text-dark-text tracking-wide"
					>
						Bio
					</label>
					<span class="text-[11px] text-slate-400 dark:text-dark-muted font-mono">
						{bio.length} / 500
					</span>
				</div>
				<textarea
					id="profile-bio"
					bind:value={bio}
					rows="3"
					placeholder="Capturing silence, light, and brutalist geometries across Scandinavia & Japan..."
					maxlength="500"
					class="w-full p-3.5 text-sm bg-slate-50 dark:bg-dark-elevated text-slate-950 dark:text-dark-text rounded-xl border {fieldErrors.bio
						? 'border-red-500 focus:ring-red-500'
						: 'border-slate-200 dark:border-dark-border focus:ring-slate-950 dark:focus:ring-white'} focus:outline-none focus:ring-1.5 transition-colors resize-y min-h-20 placeholder:text-slate-400 dark:placeholder:text-dark-subtle"
				></textarea>
				{#if fieldErrors.bio}
					<span class="text-xs text-red-600 dark:text-red-400 font-medium">
						{fieldErrors.bio}
					</span>
				{/if}
			</div>

			<!-- Website & Location Grid -->
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<!-- Website -->
				<div class="flex flex-col gap-1.5">
					<label
						for="profile-website"
						class="text-xs font-semibold text-slate-900 dark:text-dark-text tracking-wide"
					>
						Website
					</label>
					<div class="relative flex items-center">
						<Icon
							name="link"
							class="absolute left-3.5 text-slate-400 dark:text-dark-muted text-xs pointer-events-none"
						/>
						<input
							id="profile-website"
							type="text"
							bind:value={website}
							placeholder="elenarostova.com"
							maxlength="255"
							class="w-full h-11 pl-9 pr-3.5 text-sm bg-slate-50 dark:bg-dark-elevated text-slate-950 dark:text-dark-text rounded-xl border {fieldErrors.website
								? 'border-red-500 focus:ring-red-500'
								: 'border-slate-200 dark:border-dark-border focus:ring-slate-950 dark:focus:ring-white'} focus:outline-none focus:ring-1.5 transition-colors placeholder:text-slate-400 dark:placeholder:text-dark-subtle"
						/>
					</div>
					{#if fieldErrors.website}
						<span class="text-xs text-red-600 dark:text-red-400 font-medium">
							{fieldErrors.website}
						</span>
					{/if}
				</div>

				<!-- Location -->
				<div class="flex flex-col gap-1.5">
					<label
						for="profile-location"
						class="text-xs font-semibold text-slate-900 dark:text-dark-text tracking-wide"
					>
						Location
					</label>
					<div class="relative flex items-center">
						<Icon
							name="marker"
							class="absolute left-3.5 text-slate-400 dark:text-dark-muted text-xs pointer-events-none"
						/>
						<input
							id="profile-location"
							type="text"
							bind:value={location}
							placeholder="Stockholm & Kyoto"
							maxlength="100"
							class="w-full h-11 pl-9 pr-3.5 text-sm bg-slate-50 dark:bg-dark-elevated text-slate-950 dark:text-dark-text rounded-xl border {fieldErrors.location
								? 'border-red-500 focus:ring-red-500'
								: 'border-slate-200 dark:border-dark-border focus:ring-slate-950 dark:focus:ring-white'} focus:outline-none focus:ring-1.5 transition-colors placeholder:text-slate-400 dark:placeholder:text-dark-subtle"
						/>
					</div>
					{#if fieldErrors.location}
						<span class="text-xs text-red-600 dark:text-red-400 font-medium">
							{fieldErrors.location}
						</span>
					{/if}
				</div>
			</div>

			<!-- Camera Gear Field -->
			<div class="flex flex-col gap-1.5">
				<label
					for="profile-camera-gear"
					class="text-xs font-semibold text-slate-900 dark:text-dark-text tracking-wide"
				>
					Camera Gear / Setup
				</label>
				<div class="relative flex items-center">
					<Icon
						name="camera"
						class="absolute left-3.5 text-slate-400 dark:text-dark-muted text-xs pointer-events-none"
					/>
					<input
						id="profile-camera-gear"
						type="text"
						bind:value={cameraGear}
						placeholder="Hasselblad 500C/M • Leica M11"
						maxlength="200"
						class="w-full h-11 pl-9 pr-3.5 text-sm bg-slate-50 dark:bg-dark-elevated text-slate-950 dark:text-dark-text rounded-xl border {fieldErrors.cameraGear
							? 'border-red-500 focus:ring-red-500'
							: 'border-slate-200 dark:border-dark-border focus:ring-slate-950 dark:focus:ring-white'} focus:outline-none focus:ring-1.5 transition-colors placeholder:text-slate-400 dark:placeholder:text-dark-subtle"
					/>
				</div>
				{#if fieldErrors.cameraGear}
					<span class="text-xs text-red-600 dark:text-red-400 font-medium">
						{fieldErrors.cameraGear}
					</span>
				{/if}
			</div>
		</div>

		<!-- Action Buttons -->
		<div
			class="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-dark-border"
		>
			{#if onCancel}
				<Button
					type="button"
					variant="outline"
					size="md"
					disabled={isSubmitting || isUploading}
					onclick={onCancel}
				>
					Cancel
				</Button>
			{/if}

			<Button
				type="submit"
				variant="primary"
				size="md"
				disabled={!isDirty || isSubmitting || isUploading}
				loading={isSubmitting}
			>
				Save Changes
			</Button>
		</div>
	</div>
</form>
