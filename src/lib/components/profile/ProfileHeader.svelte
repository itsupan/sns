<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/shared/Icon.svelte';
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';
	import SheetAction from '$lib/components/shared/SheetAction.svelte';
	import ThemeToggle from '$lib/components/shared/ThemeToggle.svelte';
	import ShareProfileModal from './ShareProfileModal.svelte';
	import { authClient } from '$lib/auth-client';
	import { toast } from '$lib/utils/toast.svelte';
	import { formatCount } from '$lib/utils/format';
	import { readApiError } from '$lib/utils/api-error';

	import { profileStore, resolveProfile, type ProfileData } from '$lib/utils/profile.svelte';

	interface Props {
		profile?: Partial<ProfileData>;
		class?: string;
		onFollowChange?: (following: boolean) => void;
		user?: Record<string, unknown> | null;
	}

	let {
		profile: customProfile,
		class: className = '',
		onFollowChange,
		user: initialUser
	}: Props = $props();

	// Optimistic follow state; null means "use what the server loaded".
	let followOverride = $state<boolean | null>(null);
	let followersDelta = $state(0);
	let followPending = $state(false);
	let settingsOpen = $state(false);
	let desktopDropdownOpen = $state(false);
	let shareModalOpen = $state(false);
	let dropdownRef = $state<HTMLDivElement | null>(null);
	let settingsButtonRef = $state<HTMLButtonElement | null>(null);

	const session = authClient.useSession();

	const isOwnProfile = $derived.by(() => {
		if (customProfile?.isOwnProfile !== undefined) {
			return customProfile.isOwnProfile;
		}
		const sessionUserId = ($session.data?.user as { id?: string } | undefined)?.id;
		const targetUserId =
			(initialUser as { id?: string } | undefined)?.id ??
			(customProfile as { id?: string } | undefined)?.id;

		if (sessionUserId && targetUserId) {
			return sessionUserId === targetUserId;
		}
		return true;
	});

	$effect(() => {
		profileStore.init();
		const sessionUserId = ($session.data?.user as { id?: string } | undefined)?.id;
		if (isOwnProfile && sessionUserId) {
			profileStore.fetchUser(sessionUserId);
		}
	});

	const profile = $derived.by(() => {
		const effectiveUser = (
			isOwnProfile ? ($session.data?.user ?? initialUser) : (initialUser ?? customProfile)
		) as Record<string, unknown> | undefined;

		return resolveProfile(effectiveUser, isOwnProfile ? profileStore.updated : null, {
			...customProfile,
			isOwnProfile
		});
	});

	let isFollowing = $derived(followOverride ?? customProfile?.isFollowing ?? false);
	let followersCount = $derived(profile.followersCount + followersDelta);

	async function toggleFollow() {
		if (!$session.data?.user) {
			toast.show('Please log in to follow curators');
			const currentPath =
				typeof window !== 'undefined'
					? window.location.pathname + window.location.search
					: resolve('/profile');
			try {
				// eslint-disable-next-line svelte/no-navigation-without-resolve
				await goto(`${resolve('/login')}?redirectTo=${encodeURIComponent(currentPath)}`);
			} catch {
				// Router not mounted in test environment
			}
			return;
		}

		if (followPending || !profile.id) return;
		const next = !isFollowing;
		followOverride = next;
		followersDelta += next ? 1 : -1;
		followPending = true;
		try {
			const res = await fetch(`/api/users/${encodeURIComponent(profile.id)}/follow`, {
				method: 'POST'
			});
			const body = (await res.json().catch(() => null)) as {
				following?: boolean;
				followersCount?: number;
			} | null;
			if (!res.ok || typeof body?.following !== 'boolean') {
				throw new Error(readApiError(body, 'Could not update follow').message);
			}
			followOverride = body.following;
			if (typeof body.followersCount === 'number') {
				followersDelta = body.followersCount - profile.followersCount;
			}
			onFollowChange?.(body.following);
			toast.show(body.following ? `Following ${profile.name}` : `Unfollowed ${profile.name}`);
		} catch (err) {
			followOverride = !next;
			followersDelta += next ? -1 : 1;
			toast.show(err instanceof Error ? err.message : 'Could not update follow');
		} finally {
			followPending = false;
		}
	}

	async function handleMessage() {
		if (!$session.data?.user) {
			toast.show('Please log in to send messages');
			const currentPath =
				typeof window !== 'undefined'
					? window.location.pathname + window.location.search
					: resolve('/profile');
			try {
				// eslint-disable-next-line svelte/no-navigation-without-resolve
				await goto(`${resolve('/login')}?redirectTo=${encodeURIComponent(currentPath)}`);
			} catch {
				// Router not mounted in test environment
			}
			return;
		}

		toast.show(`Direct messaging with ${profile.name} is coming soon`);
	}

	function toggleSettings() {
		if (typeof window !== 'undefined' && window.innerWidth < 640) {
			settingsOpen = true;
		} else {
			desktopDropdownOpen = !desktopDropdownOpen;
		}
	}

	function onWindowClick(event: MouseEvent) {
		if (!desktopDropdownOpen) return;
		const target = event.target as Node;
		if (
			dropdownRef &&
			!dropdownRef.contains(target) &&
			settingsButtonRef &&
			!settingsButtonRef.contains(target)
		) {
			desktopDropdownOpen = false;
		}
	}

	function onWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			desktopDropdownOpen = false;
		}
	}

	function handleShare() {
		shareModalOpen = true;
	}

	async function signOut() {
		settingsOpen = false;
		desktopDropdownOpen = false;
		await authClient.signOut();
		await goto(resolve('/login'));
	}
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKeydown} />

<div class="w-full flex flex-col {className}">
	<!-- Unified Master Profile Header (Mobile + Desktop) -->
	<div
		class="w-full bg-white dark:bg-dark-card sm:border sm:border-slate-100 sm:dark:border-dark-border sm:rounded-3xl p-4 sm:p-6 lg:p-8 sm:shadow-xs dark:shadow-none transition-colors"
	>
		<div class="profile-grid gap-x-4 sm:gap-x-6 gap-y-4 sm:gap-y-6 items-center sm:items-start">
			<!-- 1. AVATAR -->
			<div class="area-avatar relative shrink-0">
				<div
					class="size-20 sm:size-24 lg:size-28 rounded-full overflow-hidden ring-2 sm:ring-4 ring-slate-100 dark:ring-dark-border sm:dark:ring-dark-elevated shadow-xs sm:shadow-sm bg-slate-100 dark:bg-dark-elevated flex items-center justify-center shrink-0"
				>
					{#if profile.avatar}
						<img src={profile.avatar} alt={profile.name} class="w-full h-full object-cover" />
					{:else}
						<span
							class="font-bold text-2xl sm:text-3xl text-slate-600 dark:text-dark-text select-none"
						>
							{profile.name ? profile.name.slice(0, 1).toUpperCase() : 'U'}
						</span>
					{/if}
				</div>

				<!-- Mobile Camera overlay button -->
				{#if profile.isOwnProfile}
					<button
						type="button"
						class="sm:hidden absolute -bottom-1 -right-1 size-7 rounded-full bg-black text-white dark:bg-dark-elevated dark:text-white flex items-center justify-center shadow-md cursor-pointer border-2 border-white dark:border-dark-card"
						aria-label="Change avatar photo"
						onclick={() => goto(resolve('/profile/edit'))}
					>
						<Icon name="camera" class="text-xs" />
					</button>
				{/if}

				<!-- Desktop Verified Badge -->
				{#if profile.isVerified}
					<div
						class="hidden sm:flex absolute bottom-1 right-1 size-6 rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-950 items-center justify-center shadow-md ring-2 ring-white dark:ring-dark-card"
						title="Verified Curator"
					>
						<Icon name="check" class="text-xs" />
					</div>
				{/if}
			</div>

			<!-- 2. STATS (Row 1 on Mobile, Spanning Bottom Row on Desktop) -->
			<div
				class="area-stats flex sm:grid sm:grid-cols-2 md:grid-cols-4 items-center justify-around sm:justify-start gap-2 sm:gap-4 sm:pt-5 sm:border-t sm:border-slate-100 sm:dark:border-dark-border text-center sm:text-left"
			>
				<!-- Posts Count -->
				<div class="flex flex-col sm:flex-row sm:items-baseline gap-0 sm:gap-2">
					<span
						class="font-bold text-lg sm:text-2xl text-slate-950 dark:text-white tracking-tight leading-tight"
					>
						{formatCount(profile.postsCount)}
					</span>
					<span class="text-xs text-slate-500 dark:text-dark-muted font-normal sm:font-medium">
						posts
					</span>
				</div>

				<!-- Followers Count -->
				<div class="flex flex-col sm:flex-row sm:items-baseline gap-0 sm:gap-2">
					<span
						class="font-bold text-lg sm:text-2xl text-slate-950 dark:text-white tracking-tight leading-tight"
					>
						{formatCount(followersCount)}
					</span>
					<span class="text-xs text-slate-500 dark:text-dark-muted font-normal sm:font-medium">
						followers
					</span>
				</div>

				<!-- Following Count -->
				<div class="flex flex-col sm:flex-row sm:items-baseline gap-0 sm:gap-2">
					<span
						class="font-bold text-lg sm:text-2xl text-slate-950 dark:text-white tracking-tight leading-tight"
					>
						{formatCount(profile.followingCount)}
					</span>
					<span class="text-xs text-slate-500 dark:text-dark-muted font-normal sm:font-medium">
						following
					</span>
				</div>

				<!-- Impressions: total views of this user's posts -->
				<div class="flex flex-col sm:flex-row sm:items-baseline gap-0 sm:gap-2">
					<span
						class="font-bold text-lg sm:text-2xl text-slate-950 dark:text-white tracking-tight leading-tight"
					>
						{formatCount(profile.impressionsCount)}
					</span>
					<span class="text-xs text-slate-500 dark:text-dark-muted font-normal sm:font-medium">
						impressions
					</span>
				</div>
			</div>

			<!-- 3. DETAILS (Name, Bio, Links) -->
			<div class="area-details flex flex-col gap-1.5 sm:gap-2 text-left">
				<!-- Name + Title / Master Curator Badge -->
				<div class="flex items-center sm:items-baseline gap-2 sm:gap-3 flex-wrap">
					<h1
						class="font-bold text-sm sm:text-2xl lg:text-3xl text-slate-950 dark:text-white tracking-tight m-0"
					>
						{profile.name}
					</h1>
					<!-- Mobile inline title -->
					{#if profile.title}
						<span class="sm:hidden text-xs text-slate-500 dark:text-dark-muted">
							· {profile.title}
						</span>
					{/if}
					<!-- Desktop Master Curator Badge -->
					{#if profile.badgeText}
						<span
							class="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated text-slate-600 dark:text-dark-muted"
						>
							{profile.badgeText}
						</span>
					{/if}
				</div>

				<!-- Desktop Handle & Subtitle -->
				<div class="hidden sm:flex items-center gap-2 text-sm text-slate-500 dark:text-dark-muted">
					<span>@{profile.handle}</span>
					{#if profile.title}
						<span>•</span>
						<span class="font-medium text-slate-700 dark:text-dark-text">{profile.title}</span>
					{/if}
				</div>

				<!-- Bio Description -->
				{#if profile.bio}
					<p
						class="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-dark-text sm:dark:text-dark-muted max-w-2xl m-0"
					>
						{profile.bio}
					</p>
				{:else if profile.isOwnProfile}
					<a
						href={resolve('/profile/edit')}
						class="text-xs sm:text-sm text-slate-400 hover:text-slate-600 dark:text-dark-muted dark:hover:text-dark-text italic no-underline flex items-center gap-1.5"
					>
						<Icon name="pencil" class="text-xs" />
						<span>Add a bio to your profile...</span>
					</a>
				{/if}

				<!-- Metadata Chips (Website, Location, Camera Gear) -->
				{#if profile.website || profile.location || profile.cameraGear}
					<div
						class="flex items-center gap-4 flex-wrap text-xs text-slate-500 dark:text-dark-muted mt-0.5 sm:mt-2"
					>
						{#if profile.website}
							<a
								href={`https://${profile.website.replace(/^https?:\/\//, '')}`}
								target="_blank"
								rel="noreferrer"
								class="inline-flex items-center gap-1.5 font-semibold sm:font-medium text-blue-600 dark:text-kizuna-blue hover:underline no-underline"
							>
								<Icon name="link" class="text-xs shrink-0" />
								<span>{profile.website.replace(/^https?:\/\//, '')}</span>
							</a>
						{/if}

						{#if profile.location}
							<div class="hidden sm:inline-flex items-center gap-1.5">
								<Icon name="marker" class="text-xs shrink-0" />
								<span>{profile.location}</span>
							</div>
						{/if}

						{#if profile.cameraGear}
							<div class="hidden sm:inline-flex items-center gap-1.5">
								<Icon name="camera" class="text-xs shrink-0" />
								<span>{profile.cameraGear}</span>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- 4. ACTION BUTTONS (Following, Message, Share) -->
			<div
				class="area-actions flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto shrink-0 self-start md:self-auto pt-1 sm:pt-0"
			>
				{#if profile.isOwnProfile}
					<!-- Current User / Own Profile Actions: Edit Profile button + Settings [ ⚙ ] -->
					<a
						href={resolve('/profile/edit')}
						class="flex-1 sm:flex-initial h-11 sm:h-10 px-4 sm:px-5 rounded-full bg-slate-100 dark:bg-dark-elevated hover:bg-slate-200 dark:hover:bg-dark-hover text-slate-900 dark:text-dark-text border border-slate-200 dark:border-dark-border flex items-center justify-center gap-1.5 font-semibold text-xs transition-colors duration-150 no-underline cursor-pointer shadow-xs"
					>
						<Icon name="pencil" class="text-xs" />
						<span>Edit Profile</span>
					</a>

					<!-- Settings Button & Desktop Dropdown Menu (Owner only) -->
					<div class="relative shrink-0">
						<button
							bind:this={settingsButtonRef}
							type="button"
							class="size-11 sm:size-10 rounded-full bg-slate-100 dark:bg-dark-elevated sm:bg-white sm:dark:bg-dark-elevated sm:border sm:border-slate-200 sm:dark:border-dark-border text-slate-700 dark:text-dark-muted hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-dark-hover active:scale-95 flex items-center justify-center transition-all duration-150 cursor-pointer border-0 shrink-0 shadow-xs"
							onclick={toggleSettings}
							aria-label="Settings"
							aria-haspopup="menu"
							aria-expanded={desktopDropdownOpen || settingsOpen}
						>
							<Icon name="settings" class="text-base sm:text-sm" />
						</button>

						<!-- Desktop Dropdown Menu (No duplicates: Share Profile, Theme, Log out) -->
						{#if desktopDropdownOpen}
							<div
								bind:this={dropdownRef}
								class="hidden sm:flex flex-col absolute right-0 top-full mt-2 w-72 p-1.5 bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-2xl shadow-xl z-50"
								role="menu"
								aria-label="Settings menu"
							>
								<button
									type="button"
									class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-dark-text hover:bg-slate-100 dark:hover:bg-dark-elevated border-0 bg-transparent text-left cursor-pointer transition-colors"
									role="menuitem"
									onclick={() => {
										desktopDropdownOpen = false;
										handleShare();
									}}
								>
									<Icon name="share" class="text-sm text-slate-500 dark:text-dark-muted shrink-0" />
									<span>Share Profile</span>
								</button>

								<div
									class="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-800 dark:text-dark-text"
								>
									<span class="flex items-center gap-2.5 shrink-0">
										<Icon name="sun" class="text-sm text-slate-500 dark:text-dark-muted shrink-0" />
										<span>Theme</span>
									</span>
									<ThemeToggle variant="segmented" class="shrink-0" />
								</div>

								<div class="h-px my-1 bg-slate-100 dark:bg-dark-border"></div>

								<button
									type="button"
									class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border-0 bg-transparent text-left cursor-pointer transition-colors"
									role="menuitem"
									onclick={() => {
										desktopDropdownOpen = false;
										signOut();
									}}
								>
									<Icon name="sign-out-alt" class="text-sm text-red-500 shrink-0" />
									<span>Log out</span>
								</button>
							</div>
						{/if}
					</div>
				{:else}
					<!-- Other User Profile: Follow, Send Message, Share Profile -->
					<!-- Follow / Following Button -->
					<button
						type="button"
						class="flex-1 sm:flex-initial h-11 sm:h-10 px-4 sm:px-5 rounded-full flex items-center justify-center gap-1.5 font-semibold text-xs transition-all duration-150 cursor-pointer border {isFollowing
							? 'bg-black text-white dark:bg-white dark:text-black border-transparent sm:border-slate-200 sm:dark:border-dark-border sm:bg-slate-100 sm:dark:bg-dark-elevated sm:text-slate-900 sm:dark:text-white sm:hover:bg-dark-hover'
							: 'bg-blue-600 text-white sm:bg-slate-950 sm:dark:bg-white sm:text-white sm:dark:text-slate-950 border-transparent hover:opacity-90'}"
						onclick={toggleFollow}
					>
						{#if isFollowing}
							<Icon name="check" class="text-xs" />
							<span>Following</span>
							<Icon name="angle-small-down" class="hidden sm:inline-block text-xs ml-0.5" />
						{:else}
							<span>Follow</span>
						{/if}
					</button>

					<!-- Message Button -->
					<button
						type="button"
						class="flex-1 sm:flex-initial h-11 sm:h-10 px-4 sm:px-5 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text sm:bg-slate-950 sm:text-white sm:dark:bg-white sm:dark:text-slate-950 hover:bg-slate-200 dark:hover:bg-dark-hover sm:hover:bg-slate-800 sm:dark:hover:bg-slate-100 flex items-center justify-center gap-1.5 font-semibold text-xs transition-colors duration-150 cursor-pointer border-0 shadow-xs"
						onclick={handleMessage}
					>
						<Icon name="envelope" class="hidden sm:inline-block text-sm" />
						<span class="sm:hidden">Message</span>
						<span class="hidden sm:inline">Send Message</span>
					</button>

					<!-- Share Profile Button -->
					<button
						type="button"
						class="size-11 sm:size-10 rounded-full bg-slate-100 dark:bg-dark-elevated sm:bg-white sm:dark:bg-dark-elevated sm:border sm:border-slate-200 sm:dark:border-dark-border text-slate-700 dark:text-dark-muted hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-dark-hover flex items-center justify-center transition-colors duration-150 cursor-pointer border-0 shrink-0 shadow-xs"
						onclick={handleShare}
						aria-label="Share profile"
						title="Share profile"
					>
						<Icon name="share" class="text-sm" />
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>

{#if profile.isOwnProfile}
	<BottomSheet bind:open={settingsOpen} title="Settings" showTitle>
		<div class="flex items-center justify-between gap-4 min-h-12 px-4">
			<span class="text-[15px] font-medium text-slate-900 dark:text-dark-text">Appearance</span>
			<ThemeToggle variant="segmented" />
		</div>
		<SheetAction
			icon="share"
			label="Share profile"
			onclick={() => {
				settingsOpen = false;
				handleShare();
			}}
		/>
		<SheetAction icon="sign-out-alt" label="Log out" danger onclick={signOut} />
	</BottomSheet>
{/if}

<ShareProfileModal bind:open={shareModalOpen} {profile} />

<style>
	.profile-grid {
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-areas:
			'avatar stats'
			'details details'
			'actions actions';
	}

	@media (min-width: 640px) {
		.profile-grid {
			grid-template-columns: auto 1fr auto;
			grid-template-areas:
				'avatar details actions'
				'stats  stats   stats';
		}
	}

	.area-avatar {
		grid-area: avatar;
	}

	.area-stats {
		grid-area: stats;
	}

	.area-details {
		grid-area: details;
	}

	.area-actions {
		grid-area: actions;
	}
</style>
