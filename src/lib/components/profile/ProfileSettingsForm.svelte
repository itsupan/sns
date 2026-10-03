<script lang="ts">
	import { readApiError } from '$lib/utils/api-error';
	import Icon from '$lib/components/shared/Icon.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { toast } from '$lib/utils/toast.svelte';
	import { authClient } from '$lib/auth-client';
	import { m } from '$lib/i18n';
	import AvatarUpload from './AvatarUpload.svelte';

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

	let isUploading = $state(false);
	let isSubmitting = $state(false);
	let saveSuccess = $state(false);
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

	function validate(): boolean {
		const errors: Record<string, string> = {};

		if (!name.trim()) {
			errors.name = m.profile_name_required();
		} else if (name.trim().length > 100) {
			errors.name = m.profile_name_too_long();
		}

		if (handle.trim()) {
			const cleanHandle = handle.trim().replace(/^@/, '');
			if (!/^[a-z0-9_.-]{1,30}$/i.test(cleanHandle)) {
				errors.handle = m.profile_handle_invalid();
			}
		}

		if (bio && bio.length > 500) {
			errors.bio = m.profile_bio_too_long();
		}

		if (title && title.length > 100) {
			errors.title = m.profile_title_too_long();
		}

		if (website && website.length > 255) {
			errors.website = m.profile_website_too_long();
		}

		if (location && location.length > 100) {
			errors.location = m.profile_location_too_long();
		}

		if (cameraGear && cameraGear.length > 200) {
			errors.cameraGear = m.profile_camera_too_long();
		}

		fieldErrors = errors;
		return Object.keys(errors).length === 0;
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		formError = null;
		fieldErrors = {};

		if (!currentUserId) {
			formError = m.profile_user_unknown();
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

			const data = (await response.json()) as { user?: UserProfileData };

			if (!response.ok) {
				const apiError = readApiError(data, m.profile_update_failed());
				if (apiError.fields && Object.keys(apiError.fields).length > 0) {
					fieldErrors = apiError.fields;
				} else {
					formError = apiError.message;
				}
				toast.show(apiError.message);
				return;
			}

			saveSuccess = true;
			formError = null;

			// Dispatch profile update event so views update immediately across the app
			if (typeof window !== 'undefined' && data.user) {
				window.dispatchEvent(new CustomEvent('kizuna:profile-updated', { detail: data.user }));
			}

			toast.show(m.profile_updated(), 3500);
			if (data.user) {
				onSuccess?.(data.user);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : m.profile_update_network_error();
			formError = message;
			saveSuccess = false;
			toast.show(message);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<form
	class="w-full max-w-2xl mx-auto flex flex-col gap-6 {className}"
	onsubmit={handleSubmit}
	aria-label={m.profile_form_label()}
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
				{m.profile_edit_title()}
			</h2>
			<p class="text-xs sm:text-sm text-slate-500 dark:text-dark-muted mt-1 m-0">
				{m.profile_edit_subtitle()}
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

		<!-- Success Alert Banner -->
		{#if saveSuccess}
			<div
				class="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-3 text-emerald-800 dark:text-emerald-300 text-sm"
				role="status"
			>
				<Icon
					name="check"
					class="text-base text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
				/>
				<div class="flex-1 font-medium">{m.profile_saved_banner()}</div>
			</div>
		{/if}

		<AvatarUpload bind:url={avatarUrl} bind:uploading={isUploading} {name} />

		<!-- Form Fields Grid -->
		<div class="flex flex-col gap-4">
			<!-- Name Field -->
			<div class="flex flex-col gap-1.5">
				<label
					for="profile-name"
					class="text-xs font-semibold text-slate-900 dark:text-dark-text tracking-wide"
				>
					{m.profile_display_name()} <span class="text-red-500">*</span>
				</label>
				<input
					id="profile-name"
					type="text"
					bind:value={name}
					required
					placeholder={m.profile_name_placeholder()}
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
					{m.profile_handle_label()}
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
						placeholder={m.profile_handle_placeholder()}
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
						{m.profile_handle_hint()}
					</span>
				{/if}
			</div>

			<!-- Title / Profession Field -->
			<div class="flex flex-col gap-1.5">
				<label
					for="profile-title"
					class="text-xs font-semibold text-slate-900 dark:text-dark-text tracking-wide"
				>
					{m.profile_title_label()}
				</label>
				<input
					id="profile-title"
					type="text"
					bind:value={title}
					placeholder={m.profile_title_placeholder()}
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
						{m.profile_bio()}
					</label>
					<span class="text-[11px] text-slate-400 dark:text-dark-muted font-mono">
						{bio.length} / 500
					</span>
				</div>
				<textarea
					id="profile-bio"
					bind:value={bio}
					rows="3"
					placeholder={m.profile_bio_placeholder()}
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
						{m.profile_website()}
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
							placeholder={m.profile_website_placeholder()}
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
						{m.profile_location()}
					</label>
					<div class="relative flex items-center">
						<Icon
							name="map-marker"
							class="absolute left-3.5 text-slate-400 dark:text-dark-muted text-xs pointer-events-none"
						/>
						<input
							id="profile-location"
							type="text"
							bind:value={location}
							placeholder={m.profile_location_placeholder()}
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
					{m.profile_camera()}
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
						placeholder={m.profile_camera_placeholder()}
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
					{m.common_cancel()}
				</Button>
			{/if}

			<Button
				type="submit"
				variant="primary"
				size="md"
				disabled={!isDirty || isSubmitting || isUploading}
				loading={isSubmitting}
			>
				{m.profile_save()}
			</Button>
		</div>
	</div>
</form>
