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
import {
	attachTagsStatements,
	normalizeMedia,
	normalizeTags,
	requireVisiblePost
} from '$lib/server/db/posts';
import { postRowAuthor, toPostCards } from '$lib/server/db/post-cards';
import { syncMentionsStatements } from '$lib/server/db/mentions';
import { requireNotBlocked } from '$lib/server/db/blocks';
import { notifyStatement } from '$lib/server/db/notifications';
import { insertPollStatements } from '$lib/server/db/polls';
import {
	MAX_POLL_DURATION_MINUTES,
	MAX_POLL_OPTIONS,
	MAX_POLL_OPTION_LENGTH,
	MIN_POLL_DURATION_MINUTES,
	MIN_POLL_OPTIONS,
	type PollInput
} from '$lib/polls';

/** A text post's poll from a composer payload, or null without one; a 400 naming `poll` if invalid. */
function validatePoll(value: unknown): PollInput | null {
	if (value === undefined || value === null) return null;
	const fail = (message: string): never => {
		throw new ApiError(400, 'validation_failed', message, { poll: message });
	};
	const { options, durationMinutes } =
		typeof value === 'object' ? (value as Record<string, unknown>) : {};
	if (
		!Array.isArray(options) ||
		options.length < MIN_POLL_OPTIONS ||
		options.length > MAX_POLL_OPTIONS
	) {
		return fail(`A poll needs ${MIN_POLL_OPTIONS} to ${MAX_POLL_OPTIONS} options`);
	}
	const labels = options.map((o) => (typeof o === 'string' ? o.trim() : ''));
	if (labels.some((label) => !label || label.length > MAX_POLL_OPTION_LENGTH)) {
		return fail(`Poll options must be 1 to ${MAX_POLL_OPTION_LENGTH} characters`);
	}
	if (new Set(labels.map((label) => label.toLowerCase())).size < labels.length) {
		return fail('Poll options must be different');
	}
	if (
		typeof durationMinutes !== 'number' ||
		!Number.isInteger(durationMinutes) ||
		durationMinutes < MIN_POLL_DURATION_MINUTES ||
		durationMinutes > MAX_POLL_DURATION_MINUTES
	) {
		return fail('A poll can run from 5 minutes to 7 days');
	}
	return { options: labels, durationMinutes };
}

/**
 * Checks a composer payload against the post rules and returns it normalized; throws a 400
 * `ApiError` naming the offending field. The payload is loose on purpose: legacy and partial
 * media and tag fields are tolerated.
 */
export function validatePostInput(
	platform: App.Platform | undefined,
	userId: string,
	input: Record<string, unknown>
) {
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
	const poll = validatePoll(input.poll);
	if (poll && postType !== 'text') {
		const message = 'Only text posts can have a poll';
		throw new ApiError(400, 'validation_failed', message, { poll: message });
	}
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

	return {
		content,
		title,
		mediaItems,
		aspectRatio,
		location,
		cameraMeta,
		postType,
		background,
		poll,
		tags
	};
}

/**
 * Validates a composer payload and stores the post with its media, poll, tags and mentions in one
 * transaction; a poll opens now. With `quoteOfId` it is a quote post of a post the author may see,
 * whose author is notified. Returns the new post in the `PostCard` shape with fresh media URLs.
 */
export async function createPost(
	db: Database,
	platform: App.Platform | undefined,
	userId: string,
	input: Record<string, unknown>
): Promise<PostData> {
	const {
		content,
		title,
		mediaItems,
		aspectRatio,
		location,
		cameraMeta,
		postType,
		background,
		poll,
		tags
	} = validatePostInput(platform, userId, input);
	const quoted =
		typeof input.quoteOfId === 'string'
			? await requireVisiblePost(db, userId, input.quoteOfId)
			: null;
	if (quoted) {
		await requireNotBlocked(db, userId, quoted.authorId, 'You cannot quote this post');
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
		quoteOfId: quoted?.id ?? null,
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
	const notifyQuoted = quoted
		? [
				notifyStatement(db, {
					type: 'quote',
					actorId: userId,
					recipientId: quoted.authorId,
					postId
				})
			]
		: [];
	// Post, media, poll, tags, mentions and the quote notification land together in one transaction.
	await db.batch([
		insertPost,
		...insertMedia,
		...(poll ? insertPollStatements(db, postId, poll, new Date()) : []),
		...attachTagsStatements(db, postId, tags),
		...mentionStatements,
		...notifyQuoted
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
