import { json, type RequestHandler } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import * as v from 'valibot';
import { post, postMedia, postTag } from '$lib/server/db/schema';
import { ApiError, parseBody, requireUser, withApi } from '$lib/server/api';
import {
	attachTagsStatements,
	loadPostMedia,
	loadPostTags,
	normalizeMedia,
	normalizeTags
} from '$lib/server/db/posts';
import { extractR2Key, refreshPostMediaUrls } from '$lib/server/services/storage';
import { MAX_MEDIA_PER_POST, MAX_TAGS_PER_POST, MAX_TAG_LENGTH } from '$lib/constants/post-limits';

/** Same fields as the create composer; anything omitted is left unchanged. */
const UpdatePostBody = v.object(
	{
		title: v.optional(
			v.pipe(
				v.nullable(v.string('Title must be a string or null')),
				v.transform((value) => value?.trim() || null),
				v.check((value) => value === null || value.length <= 200, 'Title is too long')
			)
		),
		content: v.optional(
			v.pipe(
				v.string('Content must be a string'),
				v.trim(),
				v.minLength(1, 'Post content is required'),
				v.maxLength(5000, 'Post content is too long')
			)
		),
		location: v.optional(
			v.pipe(
				v.nullable(v.string('Location must be a string or null')),
				v.transform((value) => value?.trim() || null),
				v.check((value) => value === null || value.length <= 100, 'Location is too long')
			)
		),
		tags: v.optional(v.array(v.string('Tags must be strings'), 'Tags must be an array')),
		mediaUrls: v.optional(v.array(v.unknown(), 'Media must be an array')),
		aspectRatio: v.optional(v.picklist(['1:1', '4:5', '16:9'], 'Invalid aspect ratio')),
		postType: v.optional(v.picklist(['photo', 'story', 'article'], 'Invalid post type'))
	},
	'Request body must be an object'
);

/** Loads a live post and checks the current user wrote it; 404 before 403 so ids are not probed. */
async function requireOwnPost(locals: App.Locals, postId: string | undefined, action: string) {
	const currentUser = requireUser(locals);
	if (!postId) {
		throw new ApiError(400, 'validation_failed', 'Post ID is required');
	}

	const [existingPost] = await locals.db
		.select({ id: post.id, userId: post.userId, deletedAt: post.deletedAt })
		.from(post)
		.where(eq(post.id, postId))
		.limit(1);

	if (!existingPost || existingPost.deletedAt !== null) {
		throw new ApiError(404, 'not_found', 'Post not found');
	}
	if (existingPost.userId !== currentUser.id) {
		throw new ApiError(403, 'forbidden', `You do not have permission to ${action} this post`);
	}
	return { currentUser, postId };
}

export const PATCH: RequestHandler = withApi(async ({ params, locals, request, platform }) => {
	const { currentUser, postId } = await requireOwnPost(locals, params.id, 'edit');
	const body = await parseBody(request, UpdatePostBody);

	const tags = body.tags === undefined ? undefined : normalizeTags(body.tags);
	if (tags && tags.length > MAX_TAGS_PER_POST) {
		const message = `A post can have at most ${MAX_TAGS_PER_POST} tags`;
		throw new ApiError(400, 'validation_failed', message, { tags: message });
	}
	if (tags?.some((t) => t.name.length > MAX_TAG_LENGTH)) {
		const message = `Tags can be at most ${MAX_TAG_LENGTH} characters`;
		throw new ApiError(400, 'validation_failed', message, { tags: message });
	}

	let media = body.mediaUrls === undefined ? undefined : normalizeMedia(body.mediaUrls);
	if (media && media.length > MAX_MEDIA_PER_POST) {
		const message = `A post can have at most ${MAX_MEDIA_PER_POST} media items`;
		throw new ApiError(400, 'validation_failed', message, { mediaUrls: message });
	}
	if (media) {
		// Kept media comes back as refreshed (presigned) URLs; store the original URL for the same object.
		const stored = (await loadPostMedia(locals.db, [postId])).get(postId) ?? [];
		const storedByKey = new Map(stored.map((m) => [extractR2Key(m.url) ?? m.url, m.url]));
		media = media.map((m) => ({
			...m,
			url: storedByKey.get(extractR2Key(m.url) ?? m.url) ?? m.url
		}));
	}

	const fields = Object.fromEntries(
		Object.entries({
			title: body.title,
			content: body.content,
			location: body.location,
			aspectRatio: body.aspectRatio,
			postType: body.postType
		}).filter(([, value]) => value !== undefined)
	);
	if (Object.keys(fields).length === 0 && tags === undefined && media === undefined) {
		throw new ApiError(400, 'validation_failed', 'No valid fields provided to update');
	}

	// Post fields, media and tags change together or not at all.
	await locals.db.batch([
		locals.db
			.update(post)
			.set({ ...fields, updatedAt: new Date() })
			.where(and(eq(post.id, postId), eq(post.userId, currentUser.id))),
		...(media
			? [
					locals.db.delete(postMedia).where(eq(postMedia.postId, postId)),
					...(media.length > 0
						? [
								locals.db.insert(postMedia).values(
									media.map((m, position) => ({
										id: crypto.randomUUID(),
										postId,
										url: m.url,
										type: m.type,
										position
									}))
								)
							]
						: [])
				]
			: []),
		...(tags
			? [
					locals.db.delete(postTag).where(eq(postTag.postId, postId)),
					...attachTagsStatements(locals.db, postId, tags)
				]
			: [])
	]);

	const [[updated], tagsByPost, mediaByPost] = await Promise.all([
		locals.db
			.select({
				title: post.title,
				content: post.content,
				location: post.location,
				aspectRatio: post.aspectRatio,
				postType: post.postType
			})
			.from(post)
			.where(eq(post.id, postId))
			.limit(1),
		loadPostTags(locals.db, [postId]),
		loadPostMedia(locals.db, [postId])
	]);
	const mediaItems = mediaByPost.get(postId) ?? [];

	const edits = await refreshPostMediaUrls(
		{
			id: postId,
			title: updated?.title ?? '',
			description: updated?.content ?? '',
			location: updated?.location ?? undefined,
			tags: tagsByPost.get(postId) ?? [],
			image: mediaItems[0]?.url ?? '',
			mediaUrl: mediaItems[0]?.url,
			mediaType: mediaItems[0]?.type ?? 'none',
			mediaItems,
			aspectRatio: (updated?.aspectRatio ?? '1:1') as '1:1' | '4:5' | '16:9',
			postType: (updated?.postType ?? 'photo') as 'photo' | 'story' | 'article'
		},
		platform?.env
	);

	return json({ post: edits });
});

export const DELETE: RequestHandler = withApi(async ({ params, locals }) => {
	const { currentUser, postId } = await requireOwnPost(locals, params.id, 'delete');

	// Soft delete the post
	await locals.db
		.update(post)
		.set({ deletedAt: new Date() })
		.where(and(eq(post.id, postId), eq(post.userId, currentUser.id)));

	// TODO: Schedule R2 media cleanup for the post's media items.

	return new Response(null, { status: 204 });
});
