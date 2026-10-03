import { eq } from 'drizzle-orm';
import type { Database } from '$lib/server/db';
import { post, postMedia, user } from '$lib/server/db/schema';
import type { PostData, PostType } from '$lib/components/feed/PostCard.svelte';
import { isTextBackground, type TextBackground } from '$lib/post-backgrounds';
import { isOwnUpload, refreshPostMediaUrls } from '$lib/server/services/storage';
import {
	MAX_ALT_LENGTH,
	MAX_CAMERA_META_LENGTH,
	MAX_MEDIA_PER_POST,
	MAX_POST_CONTENT_LENGTH,
	MAX_POST_LOCATION_LENGTH,
	MAX_POST_TITLE_LENGTH,
	MAX_TAGS_PER_POST,
	MAX_TAG_LENGTH,
	MAX_TEXT_POST_LENGTH
} from '$lib/constants/post-limits';
import { ApiError } from '$lib/server/api';
import { attachTagsStatements, normalizeMedia, normalizeTags } from '$lib/server/db/posts';
import { postRowAuthor, toPostCards } from '$lib/server/db/post-cards';
import { syncMentionsStatements } from '$lib/server/db/mentions';

/**
 * Validates a composer payload and stores the post with its media, tags and mentions in one
 * transaction. Returns the new post in the `PostCard` shape with fresh media URLs.
 * The payload is loose on purpose: legacy and partial media and tag fields are tolerated.
 */
export async function createPost(
	db: Database,
	platform: App.Platform | undefined,
	userId: string,
	input: Record<string, unknown>
): Promise<PostData> {
	const content = typeof input.content === 'string' ? input.content.trim() : '';
	if (!content) {
		throw new ApiError(400, 'validation_failed', 'Post content is required', {
			content: 'Post content is required'
		});
	}

	const title = typeof input.title === 'string' ? input.title.trim() : null;

	let mediaItems = normalizeMedia(input.mediaUrls);
	if (!Array.isArray(input.mediaUrls) && typeof input.mediaUrl === 'string') {
		// Legacy single-media payload.
		mediaItems = normalizeMedia([{ url: input.mediaUrl, type: input.mediaType }]);
	}

	if (mediaItems.length > MAX_MEDIA_PER_POST) {
		const message = `A post can have at most ${MAX_MEDIA_PER_POST} media items`;
		throw new ApiError(400, 'validation_failed', message, { mediaUrls: message });
	}
	if (mediaItems.some((m) => (m.alt?.length ?? 0) > MAX_ALT_LENGTH)) {
		const message = `Alt text can be at most ${MAX_ALT_LENGTH} characters`;
		throw new ApiError(400, 'validation_failed', message, { mediaUrls: message });
	}
	if (mediaItems.some((m) => !isOwnUpload(m.url, 'posts', userId, platform?.env))) {
		const message = 'Upload the media first';
		throw new ApiError(400, 'validation_failed', message, { mediaUrls: message });
	}

	const aspectRatio =
		input.aspectRatio === '4:5' || input.aspectRatio === '16:9' ? input.aspectRatio : '1:1';
	const location = typeof input.location === 'string' ? input.location.trim() || null : null;
	const cameraMeta = typeof input.cameraMeta === 'string' ? input.cameraMeta.trim() : null;

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
		input.postType === 'story' || input.postType === 'article' || input.postType === 'text'
			? input.postType
			: 'photo';

	let background: TextBackground | null = null;
	if (postType === 'text') {
		if (!isTextBackground(input.background)) {
			const message = 'Choose a background for your text post';
			throw new ApiError(400, 'validation_failed', message, { background: message });
		}
		background = input.background;
		if (mediaItems.length > 0) {
			const message = 'Text posts cannot have photos or videos';
			throw new ApiError(400, 'validation_failed', message, { mediaUrls: message });
		}
		if (content.length > MAX_TEXT_POST_LENGTH) {
			const message = `Text posts can be at most ${MAX_TEXT_POST_LENGTH} characters`;
			throw new ApiError(400, 'validation_failed', message, { content: message });
		}
	}

	const tags = normalizeTags(input.tags);
	if (tags.length > MAX_TAGS_PER_POST) {
		const message = `A post can have at most ${MAX_TAGS_PER_POST} tags`;
		throw new ApiError(400, 'validation_failed', message, { tags: message });
	}
	if (tags.some((t) => t.name.length > MAX_TAG_LENGTH)) {
		const message = `Tags can be at most ${MAX_TAG_LENGTH} characters`;
		throw new ApiError(400, 'validation_failed', message, { tags: message });
	}

	const postId = crypto.randomUUID();
	const mentionStatements = await syncMentionsStatements(db, {
		postId,
		authorId: userId,
		content,
		isNew: true
	});

	const insertPost = db.insert(post).values({
		id: postId,
		userId,
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
	const insertMedia =
		mediaItems.length > 0
			? [
					db.insert(postMedia).values(
						mediaItems.map((m, position) => ({
							id: crypto.randomUUID(),
							postId,
							url: m.url,
							type: m.type,
							alt: m.alt ?? null,
							position
						}))
					)
				]
			: [];
	// Post, media, tags and mentions land together in one transaction.
	await db.batch([
		insertPost,
		...insertMedia,
		...attachTagsStatements(db, postId, tags),
		...mentionStatements
	]);

	// Read back what was stored: existing tags keep their original spelling.
	const rows = await db
		.select({ post, user: postRowAuthor })
		.from(post)
		.innerJoin(user, eq(post.userId, user.id))
		.where(eq(post.id, postId))
		.limit(1);
	const [created] = await toPostCards(db, rows, userId);
	return refreshPostMediaUrls(created, platform?.env);
}
