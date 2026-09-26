<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/shared/Icon.svelte';
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';
	import SheetAction from '$lib/components/shared/SheetAction.svelte';
	import ThemeToggle from '$lib/components/shared/ThemeToggle.svelte';
	import { authClient } from '$lib/auth-client';
	import { toast } from '$lib/utils/toast.svelte';

	interface ProfileData {
		name: string;
		handle: string;
		title: string;
		bio: string;
		website: string;
		location: string;
		cameraGear: string;
		badgeText: string;
		avatar: string;
		postsCount: number;
		followersCount: string;
		followingCount: number;
		impressionsCount: string;
		isVerified: boolean;
		isFollowing: boolean;
	}

	interface Props {
		profile?: Partial<ProfileData>;
		class?: string;
		onFollowChange?: (following: boolean) => void;
	}

	const defaultProfile: ProfileData = {
		name: 'Elena Rostova',
		handle: 'elena.rostova',
		title: 'Architectural & Film Photographer',
		bio: 'Capturing silence, light, and brutalist geometries across Scandinavia & Japan. Hasselblad 500C/M & Leica M11.',
		website: 'elenarostova.com/archive',
		location: 'Stockholm & Kyoto',
		cameraGear: 'Carl Zeiss Planar 80mm f/2.8 • Summicron 35mm f/2',
		badgeText: 'MASTER CURATOR',
		avatar:
			'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
		postsCount: 42,
		followersCount: '18.4k',
		followingCount: 620,
		impressionsCount: '94.2k',
		isVerified: true,
		isFollowing: true
	};

	let { profile: customProfile, class: className = '', onFollowChange }: Props = $props();

	let isFollowing = $state(defaultProfile.isFollowing);
	let settingsOpen = $state(false);

	const session = authClient.useSession();

	const profile = $derived.by(() => {
		const currentUser = $session.data?.user as Record<string, unknown> | undefined;
		return {
			...defaultProfile,
			...(currentUser
				? {
						name: (currentUser.name as string) || defaultProfile.name,
						handle:
							(currentUser.handle as string) ||
							(currentUser.email
								? (currentUser.email as string).split('@')[0]
								: defaultProfile.handle),
						avatar: (currentUser.image as string) || defaultProfile.avatar,
						title: (currentUser.title as string) || defaultProfile.title,
						bio: (currentUser.bio as string) || defaultProfile.bio,
						website: (currentUser.website as string) || defaultProfile.website,
						location: (currentUser.location as string) || defaultProfile.location,
						cameraGear: (currentUser.cameraGear as string) || defaultProfile.cameraGear
					}
				: {}),
			...customProfile
		};
	});

	function toggleFollow() {
		isFollowing = !isFollowing;
		onFollowChange?.(isFollowing);
	}

	async function handleShare() {
		const url = window.location.href;
		if (navigator.share) {
			try {
				await navigator.share({ title: `${profile.name} on Kizuna`, url });
			} catch {
				// User dismissed the native share sheet.
			}
			return;
		}
		try {
			await navigator.clipboard.writeText(url);
			toast.show('Profile link copied');
		} catch {
			toast.show('Could not copy link');
		}
	}

	async function signOut() {
		settingsOpen = false;
		await authClient.signOut();
		await goto(resolve('/login'));
	}
</script>

<div class="w-full flex flex-col {className}">
	<!-- Unified Master Profile Header (Mobile + Desktop) -->
	<div
		class="w-full bg-white dark:bg-dark-card sm:border sm:border-slate-100 sm:dark:border-dark-border sm:rounded-3xl p-4 sm:p-6 lg:p-8 sm:shadow-xs dark:shadow-none transition-colors"
	>
		<div class="profile-grid gap-x-4 sm:gap-x-6 gap-y-4 sm:gap-y-6 items-center sm:items-start">
			<!-- 1. AVATAR -->
			<div class="area-avatar relative shrink-0">
				<div
					class="size-20 sm:size-24 lg:size-28 rounded-full overflow-hidden ring-2 sm:ring-4 ring-slate-100 dark:ring-dark-border sm:dark:ring-dark-elevated shadow-xs sm:shadow-sm"
				>
					<img src={profile.avatar} alt={profile.name} class="w-full h-full object-cover" />
				</div>

				<!-- Mobile Camera overlay button -->
				<button
					type="button"
					class="sm:hidden absolute -bottom-1 -right-1 size-7 rounded-full bg-black text-white dark:bg-dark-elevated dark:text-white flex items-center justify-center shadow-md cursor-pointer border-2 border-white dark:border-dark-card"
					aria-label="Change avatar photo"
					onclick={() => goto(resolve('/profile/edit'))}
				>
					<Icon name="camera" class="text-xs" />
				</button>

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
						{profile.postsCount}
					</span>
					<span class="text-xs text-slate-500 dark:text-dark-muted font-normal sm:font-medium">
						<span class="sm:hidden">posts</span>
						<span class="hidden sm:inline">Archived Works</span>
					</span>
				</div>

				<!-- Followers Count -->
				<div class="flex flex-col sm:flex-row sm:items-baseline gap-0 sm:gap-2">
					<span
						class="font-bold text-lg sm:text-2xl text-slate-950 dark:text-white tracking-tight leading-tight"
					>
						{profile.followersCount}
					</span>
					<span class="text-xs text-slate-500 dark:text-dark-muted font-normal sm:font-medium">
						<span class="sm:hidden">followers</span>
						<span class="hidden sm:inline">Curators Following</span>
					</span>
				</div>

				<!-- Following Count -->
				<div class="flex flex-col sm:flex-row sm:items-baseline gap-0 sm:gap-2">
					<span
						class="font-bold text-lg sm:text-2xl text-slate-950 dark:text-white tracking-tight leading-tight"
					>
						{profile.followingCount}
					</span>
					<span class="text-xs text-slate-500 dark:text-dark-muted font-normal sm:font-medium">
						following
					</span>
				</div>

				<!-- Impressions (Desktop only) -->
				<div class="hidden sm:flex flex-row items-baseline gap-2">
					<span
						class="font-bold text-2xl text-slate-950 dark:text-white tracking-tight leading-tight"
					>
						{profile.impressionsCount}
					</span>
					<span class="text-xs font-medium text-slate-500 dark:text-dark-muted">
						Total Impressions
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
					<span class="sm:hidden text-xs text-slate-500 dark:text-dark-muted">
						· {profile.title}
					</span>
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
					<span>•</span>
					<span class="font-medium text-slate-700 dark:text-dark-text">{profile.title}</span>
				</div>

				<!-- Bio Description -->
				<p
					class="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-dark-text sm:dark:text-dark-muted max-w-2xl m-0"
				>
					{profile.bio}
				</p>

				<!-- Metadata Chips (Website, Location, Camera Gear) -->
				<div
					class="flex items-center gap-4 flex-wrap text-xs text-slate-500 dark:text-dark-muted mt-0.5 sm:mt-2"
				>
					{#if profile.website}
						<a
							href={`https://${profile.website}`}
							target="_blank"
							rel="noreferrer"
							class="inline-flex items-center gap-1.5 font-semibold sm:font-medium text-blue-600 dark:text-kizuna-blue hover:underline no-underline"
						>
							<Icon name="link" class="text-xs shrink-0" />
							<span>{profile.website}</span>
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
			</div>

			<!-- 4. ACTION BUTTONS (Following, Message, Share) -->
			<div
				class="area-actions flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto shrink-0 self-start md:self-auto pt-1 sm:pt-0"
			>
				<!-- Follow / Following Button -->
				<button
					type="button"
					class="flex-1 sm:flex-initial h-11 sm:h-10 px-4 sm:px-5 rounded-full flex items-center justify-center gap-1.5 font-semibold text-xs transition-all duration-150 cursor-pointer border {isFollowing
						? 'bg-black text-white dark:bg-white dark:text-black border-transparent sm:border-slate-200 sm:dark:border-dark-border sm:bg-slate-100 sm:dark:bg-dark-elevated sm:text-slate-900 sm:dark:text-white sm:hover:bg-slate-200'
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
				>
					<Icon name="envelope" class="hidden sm:inline-block text-sm" />
					<span class="sm:hidden">Message</span>
					<span class="hidden sm:inline">Send Message</span>
				</button>

				<!-- Share Button -->
				<button
					type="button"
					class="size-11 sm:size-10 rounded-full bg-slate-100 dark:bg-dark-elevated sm:bg-white sm:dark:bg-dark-elevated sm:border sm:border-slate-200 sm:dark:border-dark-border text-slate-700 dark:text-dark-muted hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-dark-hover flex items-center justify-center transition-colors duration-150 cursor-pointer border-0 shrink-0"
					onclick={handleShare}
					aria-label="Share profile"
					title="Share profile"
				>
					<Icon name="share" class="text-sm" />
				</button>

				<!-- Edit Profile Button (Desktop) -->
				<a
					href={resolve('/profile/edit')}
					class="hidden sm:inline-flex h-10 px-4 rounded-full bg-slate-100 dark:bg-dark-elevated hover:bg-slate-200 dark:hover:bg-dark-hover text-slate-900 dark:text-dark-text border border-slate-200 dark:border-dark-border items-center justify-center gap-1.5 font-semibold text-xs transition-colors duration-150 no-underline shrink-0"
				>
					<Icon name="pencil" class="text-xs" />
					<span>Edit Profile</span>
				</a>

				<!-- Settings (mobile: theme + account live here instead of the app bar) -->
				<button
					type="button"
					class="sm:hidden size-11 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-muted active:scale-95 active:bg-slate-200 dark:active:bg-dark-hover flex items-center justify-center transition cursor-pointer border-0 shrink-0"
					onclick={() => (settingsOpen = true)}
					aria-label="Settings"
					aria-haspopup="dialog"
				>
					<Icon name="settings" class="text-base" />
				</button>
			</div>
		</div>
	</div>
</div>

<BottomSheet bind:open={settingsOpen} title="Settings" showTitle>
	<div class="flex items-center justify-between gap-4 min-h-12 px-4">
		<span class="text-[15px] font-medium text-slate-900 dark:text-dark-text">Appearance</span>
		<ThemeToggle variant="segmented" />
	</div>
	<SheetAction
		icon="pencil"
		label="Edit Profile"
		onclick={() => {
			settingsOpen = false;
			goto(resolve('/profile/edit'));
		}}
	/>
	<SheetAction icon="share" label="Share profile" onclick={handleShare} />
	{#if $session.data?.user}
		<SheetAction icon="sign-out-alt" label="Log out" danger onclick={signOut} />
	{:else}
		<SheetAction
			icon="sign-in-alt"
			label="Log in"
			onclick={() => {
				settingsOpen = false;
				goto(resolve('/login'));
			}}
		/>
	{/if}
</BottomSheet>

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
