import { json } from '@sveltejs/kit';
import { eq, desc, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { post, postLike, postComment, user } from '$lib/server/db/schema';
import { formatTimeAgo } from '$lib/utils/format';
import type { PostData } from '$lib/components/feed/PostCard.svelte';

export const GET: RequestHandler = async ({ url, locals }) => {
	const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 50);
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
		.orderBy(desc(post.createdAt))
		.limit(limit)
		.offset(offset);

	if (postRows.length === 0) {
		return json({ posts: [], hasMore: false, nextOffset: null });
	}

	const postIds = postRows.map((r) => r.post.id);

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
		let parsedTags: string[] = [];
		if (r.post.tags) {
			try {
				parsedTags = JSON.parse(r.post.tags);
			} catch {
				parsedTags = [];
			}
		}

		let parsedMedia: Array<{ url: string; type: 'image' | 'video' }> = [];
		if (r.post.mediaUrls) {
			try {
				parsedMedia = JSON.parse(r.post.mediaUrls);
			} catch {
				parsedMedia = [];
			}
		}
		if (parsedMedia.length === 0 && r.post.mediaUrl) {
			parsedMedia = [
				{
					url: r.post.mediaUrl,
					type: (r.post.mediaType as 'image' | 'video') || 'image'
				}
			];
		}

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
			image: parsedMedia[0]?.url || r.post.mediaUrl || '',
			mediaUrl: parsedMedia[0]?.url || r.post.mediaUrl || undefined,
			mediaType: parsedMedia[0]?.type || (r.post.mediaType as 'image' | 'video' | 'none') || 'none',
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

	const hasMore = postRows.length === limit;
	const nextOffset = hasMore ? offset + limit : null;
	return json({ posts, hasMore, nextOffset });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON payload' }, { status: 400 });
	}

	const content = typeof body.content === 'string' ? body.content.trim() : '';
	if (!content) {
		return json({ error: 'Post content is required' }, { status: 400 });
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
	const mediaUrlsJson = mediaItems.length > 0 ? JSON.stringify(mediaItems) : null;
	const aspectRatio =
		body.aspectRatio === '4:5' || body.aspectRatio === '16:9' ? body.aspectRatio : '1:1';
	const location = typeof body.location === 'string' ? body.location.trim() || null : null;

	const cameraMeta = typeof body.cameraMeta === 'string' ? body.cameraMeta.trim() : null;
	const postType: 'photo' | 'story' | 'article' =
		body.postType === 'story' || body.postType === 'article' ? body.postType : 'photo';

	let tagsJson: string | null = null;
	if (Array.isArray(body.tags)) {
		const validTags = body.tags
			.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
			.map((t) => (t.startsWith('#') ? t : `#${t}`));
		tagsJson = JSON.stringify(validTags);
	}

	const newPostId = crypto.randomUUID();

	await locals.db.insert(post).values({
		id: newPostId,
		userId: locals.user.id,
		title,
		content,
		mediaUrl,
		mediaType,
		mediaUrls: mediaUrlsJson,
		aspectRatio,
		location,
		cameraMeta,
		tags: tagsJson,
		postType,
		likesCount: 0,
		commentsCount: 0,
		sharesCount: 0
	});

	const createdPost: PostData = {
		id: newPostId,
		author: {
			id: locals.user.id,
			name: locals.user.name,
			handle: locals.user.handle
				? `@${locals.user.handle.replace(/^@/, '')}`
				: `@${locals.user.name.toLowerCase().replace(/\s+/g, '')}`,
			avatar: locals.user.image || '',
			location: location || locals.user.location || undefined,
			timeAgo: 'Just now'
		},
		title: title || '',
		description: content,
		image: mediaUrl || '',
		mediaUrl: mediaUrl || undefined,
		mediaType,
		mediaItems,
		aspectRatio,
		location: location || locals.user.location || undefined,
		cameraMeta: cameraMeta || undefined,
		tags: tagsJson ? JSON.parse(tagsJson) : [],
		likes: 0,
		commentsCount: 0,
		repostsCount: 0,
		liked: false
	};

	return json({ post: createdPost }, { status: 201 });
};
