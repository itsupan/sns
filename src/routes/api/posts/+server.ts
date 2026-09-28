import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { eq, desc, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { post, postLike, postComment, postMedia, user } from '$lib/server/db/schema';
import { formatTimeAgo } from '$lib/utils/format';
import type { PostData } from '$lib/components/feed/PostCard.svelte';
import { refreshPostMediaUrls } from '$lib/server/services/storage';
import { getConfig } from '$lib/server/config';
import { ApiError, enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';
import {
	attachTagsStatements,
	loadPostMedia,
	loadPostTags,
	normalizeTags,
	notDeleted
} from '$lib/server/db/posts';

// Kept loose on purpose: the handler below tolerates legacy/partial media and tag payloads.
const CreatePostBody = v.record(v.string(), v.unknown(), 'Request body must be an object');

export const GET: RequestHandler = withApi(async ({ url, locals, platform }) => {
	const { defaultPageSize, maxPageSize } = getConfig(platform?.env).feed;
	const limit = Math.min(
		Math.max(Number(url.searchParams.get('limit')) || defaultPageSize, 1),
		maxPageSize
	);
	const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

	const postRows = await locals.db
		.select({
			post: post,
			user: {
				id: user.id,
				name: user.name,
				handle: user.handle,
				image: user.image,
				location: user.location
			}
		})
		.from(post)
		.innerJoin(user, eq(post.userId, user.id))
		.where(notDeleted)
		.orderBy(desc(post.createdAt))
		.limit(limit)
		.offset(offset);

	if (postRows.length === 0) {
		return json({ posts: [], hasMore: false, nextOffset: null });
	}

	const postIds = postRows.map((r) => r.post.id);
	const [mediaByPost, tagsByPost] = await Promise.all([
		loadPostMedia(locals.db, postIds),
		loadPostTags(locals.db, postIds)
	]);

	// Check which posts the current authenticated user has liked
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

	// Fetch comment previews (latest comment for each post)
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

	const hasMore = postRows.length === limit;
	const nextOffset = hasMore ? offset + limit : null;
	return json({ posts: refreshedPosts, hasMore, nextOffset });
});

export const POST: RequestHandler = withApi(async ({ request, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'createPost', currentUser.id);
	const body = await parseBody(request, CreatePostBody);

	const content = typeof body.content === 'string' ? body.content.trim() : '';
	if (!content) {
		throw new ApiError(400, 'validation_failed', 'Post content is required', {
			content: 'Post content is required'
		});
	}

	const title = typeof body.title === 'string' ? body.title.trim() : null;

	let mediaItems: Array<{ url: string; type: 'image' | 'video' }> = [];
	if (Array.isArray(body.mediaUrls)) {
		mediaItems = body.mediaUrls
			.filter(
				(m): m is { url: string; type?: string } =>
					typeof m === 'object' &&
					m !== null &&
					typeof m.url === 'string' &&
					m.url.trim().length > 0
			)
			.map((m) => {
				const isVid = m.type === 'video' || /\.(mp4|webm|mov)(\?.*)?$/i.test(m.url);
				return { url: m.url.trim(), type: isVid ? ('video' as const) : ('image' as const) };
			});
	} else if (typeof body.mediaUrl === 'string' && body.mediaUrl.trim().length > 0) {
		const isVid = body.mediaType === 'video' || /\.(mp4|webm|mov)(\?.*)?$/i.test(body.mediaUrl);
		mediaItems = [{ url: body.mediaUrl.trim(), type: isVid ? 'video' : 'image' }];
	}

	const primaryMedia = mediaItems[0] ?? null;
	const mediaUrl = primaryMedia?.url ?? null;
	const mediaType = primaryMedia?.type ?? 'none';
	const aspectRatio =
		body.aspectRatio === '4:5' || body.aspectRatio === '16:9' ? body.aspectRatio : '1:1';
	const location = typeof body.location === 'string' ? body.location.trim() || null : null;

	const cameraMeta = typeof body.cameraMeta === 'string' ? body.cameraMeta.trim() : null;
	const postType: 'photo' | 'story' | 'article' =
		body.postType === 'story' || body.postType === 'article' ? body.postType : 'photo';

	const normalizedTags = normalizeTags(body.tags);
	const tags = normalizedTags.map((t) => `#${t.name}`);
	// Legacy JSON column, dual-written until the contract step of #33.
	const tagsJson = Array.isArray(body.tags) ? JSON.stringify(tags) : null;

	const newPostId = crypto.randomUUID();

	const insertPost = locals.db.insert(post).values({
		id: newPostId,
		userId: currentUser.id,
		title,
		content,
		aspectRatio,
		location,
		cameraMeta,
		tags: tagsJson,
		postType,
		likesCount: 0,
		commentsCount: 0,
		sharesCount: 0
	});

	// Post, media and tags land together in one transaction.
	const insertMedia =
		mediaItems.length > 0
			? [
					locals.db.insert(postMedia).values(
						mediaItems.map((m, position) => ({
							id: crypto.randomUUID(),
							postId: newPostId,
							url: m.url,
							type: m.type,
							position
						}))
					)
				]
			: [];
	await locals.db.batch([
		insertPost,
		...insertMedia,
		...attachTagsStatements(locals.db, newPostId, normalizedTags)
	]);
	// Existing tags keep their original spelling, so read back what was stored.
	const storedTags =
		normalizedTags.length > 0
			? ((await loadPostTags(locals.db, [newPostId])).get(newPostId) ?? [])
			: [];

	const createdPost: PostData = {
		id: newPostId,
		author: {
			id: currentUser.id,
			name: currentUser.name,
			handle: currentUser.handle
				? `@${currentUser.handle.replace(/^@/, '')}`
				: `@${currentUser.name.toLowerCase().replace(/\s+/g, '')}`,
			avatar: currentUser.image || '',
			location: location || currentUser.location || undefined,
			timeAgo: 'Just now'
		},
		title: title || '',
		description: content,
		image: mediaUrl || '',
		mediaUrl: mediaUrl || undefined,
		mediaType,
		mediaItems,
		aspectRatio,
		location: location || currentUser.location || undefined,
		cameraMeta: cameraMeta || undefined,
		tags: storedTags,
		likes: 0,
		commentsCount: 0,
		repostsCount: 0,
		liked: false
	};

	const refreshedCreatedPost = await refreshPostMediaUrls(createdPost, platform?.env);
	return json({ post: refreshedCreatedPost }, { status: 201 });
});
