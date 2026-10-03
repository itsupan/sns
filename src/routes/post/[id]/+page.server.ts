import { error } from '@sveltejs/kit';
import { eq, desc, and, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { post, postComment, user } from '$lib/server/db/schema';
import { displayHandle, formatTimeAgo } from '$lib/utils/format';
import { loadFollowedIds } from '$lib/server/db/follows';
import { loadSuggestions } from '$lib/server/explore';
import type { PostData, PostType } from '$lib/components/feed/PostCard.svelte';
import { refreshPostMediaUrls } from '$lib/server/services/storage';
import { loadPostMedia, loadPostTags, loadRecentLikers, notDeleted } from '$lib/server/db/posts';

import { backgroundOf, loadViewerPostState } from '$lib/server/db/post-cards';
import { notBlockedWith } from '$lib/server/db/blocks';
import { notPrivateTo } from '$lib/server/db/visibility';
const FALLBACK_POSTS: PostData[] = [
	{
		id: 'post-1',
		author: {
			id: 'usr_elena_dev',
			name: 'Elena Rostova',
			handle: '@elena.rostova',
			avatar:
				'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
			location: 'Copenhagen, Denmark',
			timeAgo: '3h ago'
		},
		title: 'Quiet Brutalism: Concrete Light & Shadows',
		description:
			'A study on natural dawn illumination casting geometric shadows across raw exposed concrete in the central atrium. Shot on 35mm f/1.4. The spatial tension transforms throughout the winter solstice.',
		image:
			'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80',
		mediaItems: [
			{
				url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80',
				type: 'image'
			},
			{
				url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80',
				type: 'image'
			},
			{
				url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&auto=format&fit=crop&q=80',
				type: 'image'
			},
			{
				url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&auto=format&fit=crop&q=80',
				type: 'image'
			}
		],
		aspectRatio: '4:5',
		location: 'Fondazione Prada, Milano',
		cameraMeta: '35mm · ISO 200',
		tags: ['#MinimalArchitecture', '#LightAndSpace', '#DesignArchive'],
		likes: 842,
		commentsCount: 46,
		repostsCount: 12,
		commentPreview: {
			author: 'marcus_k',
			content: 'The texture gradation is immaculate. Concrete takes light like velvet here.'
		}
	},
	{
		id: 'post-2',
		author: {
			id: 'usr_kai_dev',
			name: 'Kai Takahashi',
			handle: '@kai.raw',
			avatar:
				'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
			location: 'Kyoto, Japan',
			timeAgo: '5h ago'
		},
		title: 'Wabi-Sabi Clay & Stoneware Forms',
		description:
			'Hand-pinched Shigaraki stoneware fired in an anagama kiln over seven days. The ash melt creates an unrepeatable landscape of mineral hues and subtle texture.',
		image:
			'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=1200&auto=format&fit=crop&q=80',
		mediaItems: [
			{
				url: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=1200&auto=format&fit=crop&q=80',
				type: 'image'
			}
		],
		aspectRatio: '1:1',
		location: 'Kyoto, Japan',
		cameraMeta: '50mm · ISO 400',
		tags: ['#KyotoCeramics', '#WabiSabi', '#JapaneseCraft'],
		likes: 618,
		commentsCount: 29,
		repostsCount: 8,
		commentPreview: {
			author: 'sophia_v',
			content: 'The natural wood ash glaze turned out breathtaking.'
		}
	}
];

export const load: PageServerLoad = async ({ params, locals, url, platform }) => {
	const postId = params.id;
	if (!postId) {
		throw error(404, 'Post not found');
	}

	let postData: PostData | null = null;
	// The post exists, but its author is a private account the viewer does not follow.
	let isPrivate = false;

	if (locals.db) {
		try {
			const rows = await locals.db
				.select({
					post: post,
					user: {
						id: user.id,
						name: user.name,
						handle: user.handle,
						image: user.image,
						location: user.location
					},
					visible: notPrivateTo(locals.user?.id, post.userId).mapWith(Boolean)
				})
				.from(post)
				.innerJoin(user, eq(post.userId, user.id))
				.where(and(eq(post.id, postId), notDeleted, notBlockedWith(locals.user?.id, post.userId)))
				.limit(1);

			isPrivate = rows[0]?.visible === false;
			if (rows[0]?.visible) {
				const r = rows[0];

				// Count an impression when someone other than the author opens the post.
				if (locals.user?.id !== r.post.userId) {
					try {
						await locals.db
							.update(post)
							.set({ viewsCount: sql`${post.viewsCount} + 1` })
							.where(eq(post.id, r.post.id));
					} catch (err) {
						console.error('Failed to count post view:', err);
					}
				}
				const [mediaByPost, tagsByPost] = await Promise.all([
					loadPostMedia(locals.db, [r.post.id]),
					loadPostTags(locals.db, [r.post.id])
				]);
				const parsedTags = tagsByPost.get(r.post.id) ?? [];
				const parsedMedia = mediaByPost.get(r.post.id) ?? [];

				const followsAuthor = (await loadFollowedIds(locals.db, locals.user?.id, [r.user.id])).has(
					r.user.id
				);

				const [viewerState, likers] = await Promise.all([
					loadViewerPostState(locals.db, locals.user?.id, [postId]),
					loadRecentLikers(locals.db, locals.user?.id, [postId])
				]);

				let commentPreview: { author: string; content: string } | undefined;
				try {
					const recentComments = await locals.db
						.select({
							content: postComment.content,
							authorName: user.name,
							authorHandle: user.handle
						})
						.from(postComment)
						.innerJoin(user, eq(postComment.userId, user.id))
						.where(eq(postComment.postId, postId))
						.orderBy(desc(postComment.createdAt))
						.limit(1);

					if (recentComments[0]) {
						commentPreview = {
							author: recentComments[0].authorHandle
								? `@${recentComments[0].authorHandle.replace(/^@/, '')}`
								: recentComments[0].authorName,
							content: recentComments[0].content
						};
					}
				} catch {
					// Comments preview is optional
				}

				postData = {
					id: r.post.id,
					author: {
						id: r.user.id,
						name: r.user.name,
						handle: displayHandle(r.user.handle, r.user.name),
						avatar: r.user.image || '',
						location: r.post.location || r.user.location || undefined,
						timeAgo: formatTimeAgo(r.post.createdAt),
						isFollowing: followsAuthor
					},
					title: r.post.title || '',
					description: r.post.content,
					image: parsedMedia[0]?.url || '',
					mediaUrl: parsedMedia[0]?.url || undefined,
					mediaType: parsedMedia[0]?.type || 'none',
					mediaItems: parsedMedia,
					aspectRatio: (r.post.aspectRatio as '1:1' | '4:5' | '16:9') || '1:1',
					postType: r.post.postType as PostType,
					background: backgroundOf(r.post),
					location: r.post.location || r.user.location || undefined,
					cameraMeta: r.post.cameraMeta || undefined,
					tags: parsedTags,
					likes: r.post.likesCount,
					commentsCount: r.post.commentsCount,
					repostsCount: r.post.sharesCount,
					likedBy: likers.get(postId),
					liked: viewerState.liked.has(postId),
					saved: viewerState.saved.has(postId),
					commentPreview
				};
			}
		} catch (err) {
			console.error('Failed to load post by id from database:', err);
		}
	}

	if (isPrivate) {
		throw error(403, 'This account is private');
	}

	if (!postData) {
		const fallback = FALLBACK_POSTS.find((p) => p.id === postId);
		if (fallback) {
			postData = fallback;
		}
	}

	if (!postData) {
		throw error(404, 'Post not found');
	}

	const origin =
		url.origin && !url.origin.includes('localhost') && !url.origin.includes('127.0.0.1')
			? url.origin
			: platform?.env?.BETTER_AUTH_URL || url.origin;

	const refreshedPost = await refreshPostMediaUrls(postData, platform?.env);

	return {
		post: refreshedPost,
		postUrl: `${origin}/post/${refreshedPost.id}`,
		origin,
		// The sidebar is optional: a failure here must not take the post down.
		suggestions: await loadSuggestions(locals.db, locals.user?.id, platform?.env).catch(() => [])
	};
};
