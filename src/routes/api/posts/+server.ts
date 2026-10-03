import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { post, postMedia } from '$lib/server/db/schema';
import type { PostData, PostType } from '$lib/components/feed/PostCard.svelte';
import { isTextBackground, type TextBackground } from '$lib/post-backgrounds';
import { isOwnUpload, refreshPostMediaUrls } from '$lib/server/services/storage';
import { getConfig } from '$lib/server/config';
import {
	MAX_CAMERA_META_LENGTH,
	MAX_MEDIA_PER_POST,
	MAX_POST_CONTENT_LENGTH,
	MAX_POST_LOCATION_LENGTH,
	MAX_POST_TITLE_LENGTH,
	MAX_TAGS_PER_POST,
	MAX_TAG_LENGTH,
	MAX_TEXT_POST_LENGTH
} from '$lib/constants/post-limits';
import { ApiError, enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';
import {
	attachTagsStatements,
	decodeCursor,
	loadFeedPage,
	loadPostTags,
	normalizeMedia,
	normalizeTags
} from '$lib/server/db/posts';
import { toPostCards } from '$lib/server/db/post-cards';
import { syncMentionsStatements } from '$lib/server/db/mentions';
import { displayHandle } from '$lib/utils/format';

// Kept loose on purpose: the handler below tolerates legacy/partial media and tag payloads.
const CreatePostBody = v.record(v.string(), v.unknown(), 'Request body must be an object');

export const GET: RequestHandler = withApi(async ({ url, locals, platform }) => {
	const { defaultPageSize, maxPageSize } = getConfig(platform?.env).feed;
	const limit = Math.min(
		Math.max(Number(url.searchParams.get('limit')) || defaultPageSize, 1),
		maxPageSize
	);

	const rawCursor = url.searchParams.get('cursor');
	const cursor = rawCursor ? decodeCursor(rawCursor) : null;
	if (rawCursor && !cursor) {
		throw new ApiError(400, 'validation_failed', 'Invalid cursor', { cursor: 'Invalid cursor' });
	}

	const page = await loadFeedPage(locals.db, { limit, cursor, viewerId: locals.user?.id });
	const postRows = page.rows;

	if (postRows.length === 0) {
		return json({ posts: [], hasMore: false, nextCursor: null });
	}

	const posts = await toPostCards(locals.db, postRows, locals.user?.id);

	const refreshedPosts = await Promise.all(
		posts.map((p) => refreshPostMediaUrls(p, platform?.env))
	);

	return json({
		posts: refreshedPosts,
		hasMore: page.hasMore,
		nextCursor: page.nextCursor
	});
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

	let mediaItems = normalizeMedia(body.mediaUrls);
	if (!Array.isArray(body.mediaUrls) && typeof body.mediaUrl === 'string') {
		// Legacy single-media payload.
		mediaItems = normalizeMedia([{ url: body.mediaUrl, type: body.mediaType }]);
	}

	if (mediaItems.length > MAX_MEDIA_PER_POST) {
		const message = `A post can have at most ${MAX_MEDIA_PER_POST} media items`;
		throw new ApiError(400, 'validation_failed', message, { mediaUrls: message });
	}
	if (mediaItems.some((m) => !isOwnUpload(m.url, 'posts', currentUser.id, platform?.env))) {
		const message = 'Upload the media first';
		throw new ApiError(400, 'validation_failed', message, { mediaUrls: message });
	}

	const primaryMedia = mediaItems[0] ?? null;
	const mediaUrl = primaryMedia?.url ?? null;
	const mediaType = primaryMedia?.type ?? 'none';
	const aspectRatio =
		body.aspectRatio === '4:5' || body.aspectRatio === '16:9' ? body.aspectRatio : '1:1';
	const location = typeof body.location === 'string' ? body.location.trim() || null : null;

	const cameraMeta = typeof body.cameraMeta === 'string' ? body.cameraMeta.trim() : null;

	const tooLong = (
		[
			['content', content, MAX_POST_CONTENT_LENGTH, 'Post content is too long'],
			['title', title, MAX_POST_TITLE_LENGTH, 'Title is too long'],
			['location', location, MAX_POST_LOCATION_LENGTH, 'Location is too long'],
			['cameraMeta', cameraMeta, MAX_CAMERA_META_LENGTH, 'Camera details are too long']
		] as const
	).find(([, value, max]) => (value?.length ?? 0) > max);
	if (tooLong) {
		throw new ApiError(400, 'validation_failed', tooLong[3], { [tooLong[0]]: tooLong[3] });
	}

	const postType: PostType =
		body.postType === 'story' || body.postType === 'article' || body.postType === 'text'
			? body.postType
			: 'photo';

	let background: TextBackground | null = null;
	if (postType === 'text') {
		if (!isTextBackground(body.background)) {
			const message = 'Choose a background for your text post';
			throw new ApiError(400, 'validation_failed', message, { background: message });
		}
		background = body.background;
		if (mediaItems.length > 0) {
			const message = 'Text posts cannot have photos or videos';
			throw new ApiError(400, 'validation_failed', message, { mediaUrls: message });
		}
		if (content.length > MAX_TEXT_POST_LENGTH) {
			const message = `Text posts can be at most ${MAX_TEXT_POST_LENGTH} characters`;
			throw new ApiError(400, 'validation_failed', message, { content: message });
		}
	}

	const normalizedTags = normalizeTags(body.tags);
	if (normalizedTags.length > MAX_TAGS_PER_POST) {
		const message = `A post can have at most ${MAX_TAGS_PER_POST} tags`;
		throw new ApiError(400, 'validation_failed', message, { tags: message });
	}
	if (normalizedTags.some((t) => t.name.length > MAX_TAG_LENGTH)) {
		const message = `Tags can be at most ${MAX_TAG_LENGTH} characters`;
		throw new ApiError(400, 'validation_failed', message, { tags: message });
	}

	const newPostId = crypto.randomUUID();
	const mentionStatements = await syncMentionsStatements(locals.db, {
		postId: newPostId,
		authorId: currentUser.id,
		content,
		isNew: true
	});

	const insertPost = locals.db.insert(post).values({
		id: newPostId,
		userId: currentUser.id,
		title,
		content,
		aspectRatio,
		location,
		cameraMeta,
		postType,
		background,
		likesCount: 0,
		commentsCount: 0,
		sharesCount: 0
	});

	// Post, media, tags and mentions land together in one transaction.
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
		...attachTagsStatements(locals.db, newPostId, normalizedTags),
		...mentionStatements
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
			handle: displayHandle(currentUser.handle, currentUser.name),
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
		postType,
		background: background ?? undefined,
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
