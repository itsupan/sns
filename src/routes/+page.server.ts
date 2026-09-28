import { eq, desc, inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { postLike, postComment, user } from '$lib/server/db/schema';
import { formatTimeAgo } from '$lib/utils/format';
import type { PostData } from '$lib/components/feed/PostCard.svelte';
import { refreshPostMediaUrls } from '$lib/server/services/storage';
import { loadFeedPage, loadPostMedia, loadPostTags } from '$lib/server/db/posts';
import { getConfig } from '$lib/server/config';

const FALLBACK_POSTS: PostData[] = [
	{
		id: 'post-1',
		author: {
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

export const load: PageServerLoad = async ({ locals, platform }) => {
	const pageSize = getConfig(platform?.env).feed.defaultPageSize;
	try {
		const page = await loadFeedPage(locals.db, { limit: pageSize });
		const postRows = page.rows;

		if (postRows.length === 0) {
			return { posts: FALLBACK_POSTS, hasMore: false, nextCursor: null, pageSize };
		}

		const postIds = postRows.map((r) => r.post.id);
		const [mediaByPost, tagsByPost] = await Promise.all([
			loadPostMedia(locals.db, postIds),
			loadPostTags(locals.db, postIds)
		]);

		const likedSet = new Set<string>();
		if (locals.user) {
			const userLikes = await locals.db
				.select({ postId: postLike.postId })
				.from(postLike)
				.where(eq(postLike.userId, locals.user.id));
			for (const l of userLikes) {
				likedSet.add(l.postId);
			}
		}

		const recentComments = await locals.db
			.select({
				postId: postComment.postId,
				content: postComment.content,
				authorName: user.name,
				authorHandle: user.handle
			})
			.from(postComment)
			.innerJoin(user, eq(postComment.userId, user.id))
			.where(inArray(postComment.postId, postIds))
			.orderBy(desc(postComment.createdAt));

		const commentPreviewMap = new Map<string, { author: string; content: string }>();
		for (const c of recentComments) {
			if (!commentPreviewMap.has(c.postId)) {
				commentPreviewMap.set(c.postId, {
					author: c.authorHandle ? `@${c.authorHandle}` : c.authorName,
					content: c.content
				});
			}
		}

		const posts: PostData[] = postRows.map((r) => {
			const parsedTags = tagsByPost.get(r.post.id) ?? [];
			const parsedMedia = mediaByPost.get(r.post.id) ?? [];

			return {
				id: r.post.id,
				author: {
					id: r.user.id,
					name: r.user.name,
					handle: r.user.handle
						? `@${r.user.handle.replace(/^@/, '')}`
						: `@${r.user.name.toLowerCase().replace(/\s+/g, '')}`,
					avatar: r.user.image || '',
					location: r.post.location || r.user.location || undefined,
					timeAgo: formatTimeAgo(r.post.createdAt)
				},
				title: r.post.title || '',
				description: r.post.content,
				image: parsedMedia[0]?.url || '',
				mediaUrl: parsedMedia[0]?.url || undefined,
				mediaType: parsedMedia[0]?.type || 'none',
				mediaItems: parsedMedia,
				aspectRatio: (r.post.aspectRatio as '1:1' | '4:5' | '16:9') || '1:1',
				postType: r.post.postType as 'photo' | 'story' | 'article',
				location: r.post.location || r.user.location || undefined,
				cameraMeta: r.post.cameraMeta || undefined,
				tags: parsedTags,
				likes: r.post.likesCount,
				commentsCount: r.post.commentsCount,
				repostsCount: r.post.sharesCount,
				liked: likedSet.has(r.post.id),
				commentPreview: commentPreviewMap.get(r.post.id)
			};
		});

		const refreshedPosts = await Promise.all(
			posts.map((p) => refreshPostMediaUrls(p, platform?.env))
		);

		return {
			posts: refreshedPosts,
			hasMore: page.hasMore,
			nextCursor: page.nextCursor,
			pageSize
		};
	} catch (err) {
		console.error('Failed to load feed posts from database:', err);
		return { posts: FALLBACK_POSTS, hasMore: false, nextCursor: null, pageSize };
	}
};
