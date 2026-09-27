import { error } from '@sveltejs/kit';
import { eq, or, desc, and } from 'drizzle-orm';
import { user, post } from '$lib/server/db/schema';
import { formatTimeAgo } from '$lib/utils/format';
import type { GridItem } from '$lib/components/profile/ProfileGrid.svelte';
import type { PageServerLoad } from './$types';
import { refreshMediaUrl } from '$lib/server/services/storage';
import { loadPostMedia, notDeleted } from '$lib/server/db/posts';

const FALLBACK_CURATORS: Record<
	string,
	{
		user: {
			id: string;
			name: string;
			email: string;
			image: string;
			handle: string;
			title: string;
			bio: string;
			website: string;
			location: string;
			cameraGear: string;
		};
		posts: GridItem[];
	}
> = {
	'elena.rostova': {
		user: {
			id: 'usr_elena_dev',
			name: 'Elena Rostova',
			email: 'elena@kizuna.art',
			image:
				'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
			handle: 'elena.rostova',
			title: 'Architectural & Film Photographer',
			bio: 'Architectural & Film Photographer capturing silence, light, and brutalist geometries across Scandinavia & Japan.',
			website: 'elenarostova.art',
			location: 'Copenhagen, Denmark',
			cameraGear: 'Leica M6 · Hasselblad 500C/M'
		},
		posts: [
			{
				id: 'post-1',
				title: 'Quiet Brutalism: Concrete Light & Shadows',
				image:
					'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80',
				likes: 842,
				comments: 46,
				isCarousel: true,
				cameraMeta: '35mm · ISO 200',
				description:
					'A study on natural dawn illumination casting geometric shadows across raw exposed concrete in the central atrium. Shot on 35mm f/1.4. The spatial tension transforms throughout the winter solstice.',
				tags: ['#MinimalArchitecture', '#LightAndSpace', '#DesignArchive'],
				date: '3h ago',
				location: 'Fondazione Prada, Milano'
			}
		]
	},
	'kai.raw': {
		user: {
			id: 'usr_kai_dev',
			name: 'Kai Takahashi',
			email: 'kai@kizuna.art',
			image:
				'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
			handle: 'kai.raw',
			title: 'Ceramicist & Visual Poet',
			bio: 'Ceramicist & visual poet exploring wabi-sabi aesthetics and tea culture.',
			website: 'kaitakahashi.jp',
			location: 'Kyoto, Japan',
			cameraGear: '50mm · ISO 400'
		},
		posts: [
			{
				id: 'post-2',
				title: 'Wabi-Sabi Clay & Stoneware Forms',
				image:
					'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=1200&auto=format&fit=crop&q=80',
				likes: 618,
				comments: 29,
				isCarousel: false,
				cameraMeta: '50mm · ISO 400',
				description:
					'Hand-pinched Shigaraki stoneware fired in an anagama kiln over seven days. The ash melt creates an unrepeatable landscape of mineral hues and subtle texture.',
				tags: ['#KyotoCeramics', '#WabiSabi', '#JapaneseCraft'],
				date: '5h ago',
				location: 'Kyoto, Japan'
			}
		]
	}
};

export const load: PageServerLoad = async ({ params, locals, url, platform }) => {
	const rawId = params.id;
	if (!rawId) {
		throw error(404, 'User not found');
	}
	const cleanId = rawId.startsWith('@') ? rawId.slice(1) : rawId;

	let targetUser: Record<string, unknown> | null = null;
	let targetPosts: GridItem[] = [];

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
				.where(or(eq(user.id, cleanId), eq(user.handle, cleanId)))
				.limit(1);

			targetUser = rows[0] ?? null;

			if (targetUser) {
				const postRows = await locals.db
					.select()
					.from(post)
					.where(and(eq(post.userId, targetUser.id as string), notDeleted))
					.orderBy(desc(post.createdAt));

				const mediaByPost = await loadPostMedia(
					locals.db,
					postRows.map((p) => p.id)
				);

				targetPosts = postRows.map((p) => {
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
			}
		} catch {
			// Query failed
		}
	}

	if (!targetUser) {
		const fallback =
			FALLBACK_CURATORS[cleanId] ||
			(cleanId === 'usr_elena_dev'
				? FALLBACK_CURATORS['elena.rostova']
				: cleanId === 'usr_kai_dev'
					? FALLBACK_CURATORS['kai.raw']
					: null);
		if (fallback) {
			targetUser = fallback.user;
			targetPosts = fallback.posts;
		}
	}

	if (!targetUser) {
		throw error(404, 'User not found');
	}

	const isOwnProfile = Boolean(locals.user && locals.user.id === targetUser.id);

	const origin =
		url.origin && !url.origin.includes('localhost') && !url.origin.includes('127.0.0.1')
			? url.origin
			: platform?.env?.BETTER_AUTH_URL || url.origin;

	const handleStr = targetUser.handle as string | null | undefined;
	const canonicalHandle = handleStr ? `@${handleStr.replace(/^@/, '')}` : (targetUser.id as string);
	const canonicalUrl = `${origin}/profile/${canonicalHandle}`;

	const refreshedImage = targetUser.image
		? await refreshMediaUrl(targetUser.image as string, platform?.env)
		: null;

	const refreshedPosts = await Promise.all(
		targetPosts.map(async (p) => ({
			...p,
			image: p.image ? await refreshMediaUrl(p.image, platform?.env) : ''
		}))
	);

	return {
		targetUser: {
			id: targetUser.id,
			name: targetUser.name,
			email: targetUser.email,
			image: refreshedImage,
			handle: (targetUser.handle as string | null | undefined) ?? null,
			title: (targetUser.title as string | null | undefined) ?? null,
			bio: (targetUser.bio as string | null | undefined) ?? null,
			website: (targetUser.website as string | null | undefined) ?? null,
			location: (targetUser.location as string | null | undefined) ?? null,
			cameraGear: (targetUser.cameraGear as string | null | undefined) ?? null
		},
		isOwnProfile,
		posts: refreshedPosts,
		canonicalUrl,
		origin
	};
};
