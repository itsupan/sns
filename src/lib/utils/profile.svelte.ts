import { m } from '$lib/i18n';
import type { FollowStatus } from './follow.svelte';

export interface ProfileData {
	id?: string;
	name: string;
	/** Without the `@`; null until the user picks one. */
	handle: string | null;
	title: string;
	bio: string;
	website: string;
	location: string;
	cameraGear: string;
	badgeText: string;
	avatar: string;
	postsCount: number;
	followersCount: number;
	followingCount: number;
	impressionsCount: number;
	followStatus: FollowStatus;
	isOwnProfile?: boolean;
}

export const defaultProfile: ProfileData = {
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
	followersCount: 18400,
	followingCount: 620,
	impressionsCount: 94200,
	followStatus: 'following',
	isOwnProfile: false
};

class ProfileStore {
	private updatedUser = $state<Record<string, unknown> | null>(null);
	private isListening = false;
	private fetchingId: string | null = null;

	init() {
		if (typeof window === 'undefined' || this.isListening) return;
		this.isListening = true;

		window.addEventListener('kizuna:profile-updated', (event: Event) => {
			const customEvt = event as CustomEvent<Record<string, unknown>>;
			if (customEvt.detail) {
				this.updatedUser = customEvt.detail;
			}
		});
	}

	setUpdatedUser(user: Record<string, unknown> | null) {
		this.updatedUser = user;
	}

	fetchUser(userId: string) {
		if (typeof window === 'undefined') return;
		if (this.fetchingId === userId || this.updatedUser) return;
		this.fetchingId = userId;

		fetch(`/api/users/${encodeURIComponent(userId)}`)
			.then((res) => (res.ok ? (res.json() as Promise<{ user?: Record<string, unknown> }>) : null))
			.then((data) => {
				if (data?.user) {
					this.updatedUser = data.user;
				}
			})
			.catch(() => null)
			.finally(() => {
				this.fetchingId = null;
			});
	}

	get updated() {
		return this.updatedUser;
	}

	reset() {
		this.updatedUser = null;
		this.fetchingId = null;
	}
}

export const profileStore = new ProfileStore();

function countOr(value: unknown, fallback: number | undefined): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : (fallback ?? 0);
}

export function resolveProfile(
	sessionUser: Record<string, unknown> | undefined,
	updatedUser: Record<string, unknown> | null,
	custom?: Partial<ProfileData>
): ProfileData {
	const user = updatedUser || sessionUser;

	if (!user) {
		return {
			...defaultProfile,
			...custom
		};
	}

	return {
		id: (user.id as string) || custom?.id,
		name: (user.name as string) || custom?.name || m.common_user(),
		handle: (user.handle as string | null)?.replace(/^@/, '') || custom?.handle || null,
		avatar: (user.image as string) ?? custom?.avatar ?? '',
		title: (user.title as string) ?? custom?.title ?? '',
		bio: (user.bio as string) ?? custom?.bio ?? '',
		website: (user.website as string) ?? custom?.website ?? '',
		location: (user.location as string) ?? custom?.location ?? '',
		cameraGear: (user.cameraGear as string) ?? custom?.cameraGear ?? '',
		badgeText: (user.badgeText as string) ?? custom?.badgeText ?? '',
		postsCount: countOr(user.postsCount, custom?.postsCount),
		followersCount: countOr(user.followersCount, custom?.followersCount),
		followingCount: countOr(user.followingCount, custom?.followingCount),
		impressionsCount: countOr(user.impressionsCount, custom?.impressionsCount),
		followStatus: custom?.followStatus ?? 'none',
		isOwnProfile: custom?.isOwnProfile ?? true,
		...custom
	};
}
