import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { eq } from 'drizzle-orm';
import { user } from '$lib/server/db/schema';
import type { PostData } from '$lib/components/feed/PostCard.svelte';
import type { PageServerLoad } from './$types';
import { refreshMediaUrl, refreshPostMediaUrls } from '$lib/server/services/storage';
import {
	EMPTY_PROFILE_STATS,
	loadProfilePosts,
	loadProfileStats,
	toGridItem
} from '$lib/server/db/profiles';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	if (!locals.user) {
		throw redirect(
			302,
			`${resolve('/login')}?redirectTo=${encodeURIComponent(url.pathname + url.search)}`
		);
	}

	let dbUser: Record<string, unknown> | null = null;
	let userPosts: PostData[] = [];
	let stats = EMPTY_PROFILE_STATS;

	if (locals.db) {
		try {
			const rows = await locals.db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					image: user.image,
					handle: user.handle,
					title: user.title,
					bio: user.bio,
					website: user.website,
					location: user.location,
					cameraGear: user.cameraGear,
					createdAt: user.createdAt,
					updatedAt: user.updatedAt
				})
				.from(user)
				.where(eq(user.id, locals.user.id))
				.limit(1);

			const found = rows[0] ?? null;
			dbUser = found;
			userPosts = await loadProfilePosts(
				locals.db,
				{
					id: locals.user.id,
					name: found?.name ?? locals.user.name,
					handle: found?.handle ?? null,
					image: found?.image ?? null,
					location: found?.location ?? null
				},
				locals.user.id
			);
		} catch {
			// Fallback to locals.user
		}

		try {
			stats = await loadProfileStats(locals.db, locals.user.id, locals.user.id);
		} catch {
			// Stats are optional; keep zeros.
		}
	}

	const currentUser = (dbUser ?? locals.user) as Record<string, unknown>;

	const refreshedImage = currentUser.image
		? await refreshMediaUrl(currentUser.image as string, platform?.env)
		: null;

	const refreshedPosts = await Promise.all(
		userPosts.map(async (p) => toGridItem(await refreshPostMediaUrls(p, platform?.env)))
	);

	return {
		user: {
			id: currentUser.id,
			name: currentUser.name,
			email: currentUser.email,
			image: refreshedImage,
			handle: (currentUser.handle as string | null | undefined) ?? null,
			title: (currentUser.title as string | null | undefined) ?? null,
			bio: (currentUser.bio as string | null | undefined) ?? null,
			website: (currentUser.website as string | null | undefined) ?? null,
			location: (currentUser.location as string | null | undefined) ?? null,
			cameraGear: (currentUser.cameraGear as string | null | undefined) ?? null
		},
		posts: refreshedPosts,
		stats
	};
};
