import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { eq, desc, and } from 'drizzle-orm';
import { user, post } from '$lib/server/db/schema';
import { formatTimeAgo } from '$lib/utils/format';
import type { GridItem } from '$lib/components/profile/ProfileGrid.svelte';
import type { PageServerLoad } from './$types';
import { refreshMediaUrl } from '$lib/server/services/storage';
import { loadPostMedia, notDeleted } from '$lib/server/db/posts';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	if (!locals.user) {
		throw redirect(
			302,
			`${resolve('/login')}?redirectTo=${encodeURIComponent(url.pathname + url.search)}`
		);
	}

	let dbUser: Record<string, unknown> | null = null;
	let userPosts: GridItem[] = [];

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

			dbUser = rows[0] ?? null;

			const postRows = await locals.db
				.select()
				.from(post)
				.where(and(eq(post.userId, locals.user.id), notDeleted))
				.orderBy(desc(post.createdAt));

			const mediaByPost = await loadPostMedia(
				locals.db,
				postRows.map((p) => p.id)
			);

			userPosts = postRows.map((p) => {
				const parsedMedia = mediaByPost.get(p.id) ?? [];

				let parsedTags: string[] = [];
				if (p.tags) {
					try {
						parsedTags = JSON.parse(p.tags);
					} catch {
						parsedTags = [];
					}
				}

				return {
					id: p.id,
					title: p.title || p.content.slice(0, 40),
					image: parsedMedia[0]?.url || '',
					likes: p.likesCount,
					comments: p.commentsCount,
					isCarousel: parsedMedia.length > 1,
					cameraMeta: p.cameraMeta || undefined,
					description: p.content,
					tags: parsedTags,
					date: formatTimeAgo(p.createdAt),
					location: p.location || undefined
				};
			});
		} catch {
			// Fallback to locals.user
		}
	}

	const currentUser = (dbUser ?? locals.user) as Record<string, unknown>;

	const refreshedImage = currentUser.image
		? await refreshMediaUrl(currentUser.image as string, platform?.env)
		: null;

	const refreshedPosts = await Promise.all(
		userPosts.map(async (p) => ({
			...p,
			image: p.image ? await refreshMediaUrl(p.image, platform?.env) : ''
		}))
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
		posts: refreshedPosts
	};
};
