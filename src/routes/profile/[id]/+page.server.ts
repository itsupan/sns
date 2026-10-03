import { error } from '@sveltejs/kit';
import { eq, or } from 'drizzle-orm';
import { user } from '$lib/server/db/schema';
import type { GridItem } from '$lib/components/profile/ProfileGrid.svelte';
import type { PageServerLoad } from './$types';
import { refreshMediaUrl, refreshPostMediaUrls } from '$lib/server/services/storage';
import { getConfig } from '$lib/server/config';
import {
	EMPTY_PROFILE_STATS,
	loadProfilePosts,
	loadProfileStats,
	toGridItem
} from '$lib/server/db/profiles';
import { loadSavedPreview } from '$lib/server/db/saves';
import { blockStatus } from '$lib/server/db/blocks';
import { loadMutedIds } from '$lib/server/db/mutes';

export const load: PageServerLoad = async ({ params, locals, url, platform }) => {
	const rawId = params.id;
	if (!rawId) {
		throw error(404, 'User not found');
	}
	const cleanId = rawId.startsWith('@') ? rawId.slice(1) : rawId;

	const [targetUser] = await locals.db
		.select({
			id: user.id,
			name: user.name,
			image: user.image,
			handle: user.handle,
			title: user.title,
			bio: user.bio,
			website: user.website,
			location: user.location,
			cameraGear: user.cameraGear,
			isPrivate: user.isPrivate,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt
		})
		.from(user)
		.where(or(eq(user.id, cleanId), eq(user.handle, cleanId)))
		.limit(1);
	if (!targetUser) {
		throw error(404, 'User not found');
	}

	const viewerId = locals.user?.id ?? null;
	// Either way round, a block shows a limited profile: no posts (`loadProfilePosts` leaves them
	// out), no follow or message. A private account's posts are left out the same way until the
	// viewer follows it.
	const [block, mutedIds, firstPage, stats] = await Promise.all([
		viewerId && viewerId !== targetUser.id
			? blockStatus(locals.db, viewerId, targetUser.id)
			: { blocked: false, blockedBy: false },
		loadMutedIds(locals.db, viewerId, [targetUser.id]),
		loadProfilePosts(locals.db, targetUser.id, viewerId, {
			limit: getConfig(platform?.env).profile.defaultPageSize
		}),
		loadProfileStats(locals.db, targetUser.id, viewerId).catch(() => EMPTY_PROFILE_STATS)
	]);
	const gridPosts = await Promise.all(
		firstPage.posts.map(async (p) => toGridItem(await refreshPostMediaUrls(p, platform?.env)))
	);

	const isOwnProfile = viewerId === targetUser.id;
	const isLocked = targetUser.isPrivate && !isOwnProfile && stats.followStatus !== 'following';
	let saved: GridItem[] = [];
	if (isOwnProfile) {
		try {
			const cards = await loadSavedPreview(locals.db, targetUser.id);
			saved = await Promise.all(
				cards.map(async (p) => toGridItem(await refreshPostMediaUrls(p, platform?.env)))
			);
		} catch (err) {
			console.error('Failed to load saved posts:', err);
		}
	}

	const origin =
		url.origin && !url.origin.includes('localhost') && !url.origin.includes('127.0.0.1')
			? url.origin
			: platform?.env?.BETTER_AUTH_URL || url.origin;

	const canonicalHandle = targetUser.handle
		? `@${targetUser.handle.replace(/^@/, '')}`
		: targetUser.id;
	const canonicalUrl = `${origin}/profile/${canonicalHandle}`;

	return {
		targetUser: {
			id: targetUser.id,
			name: targetUser.name,
			image: targetUser.image ? await refreshMediaUrl(targetUser.image, platform?.env) : null,
			handle: targetUser.handle,
			title: targetUser.title,
			bio: targetUser.bio,
			website: targetUser.website,
			location: targetUser.location,
			cameraGear: targetUser.cameraGear
		},
		isOwnProfile,
		isLocked,
		block,
		muted: mutedIds.has(targetUser.id),
		posts: gridPosts,
		nextCursor: firstPage.nextCursor,
		saved,
		stats,
		canonicalUrl,
		origin
	};
};
