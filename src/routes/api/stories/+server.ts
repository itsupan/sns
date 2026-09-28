import { json } from '@sveltejs/kit';
import { desc, eq, inArray } from 'drizzle-orm';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { user, userFollow } from '$lib/server/db/schema';
import { extractR2Key, refreshMediaUrl } from '$lib/server/services/storage';
import { ApiError, enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';
import {
	MAX_STORY_AUTHORS,
	MAX_STORY_CAPTION,
	MAX_STORY_LOCATION,
	getSeenStoryIds,
	listStoriesByUser,
	listViews,
	putStory
} from '$lib/server/stories';

const VIDEO_URL = /\.(mp4|webm|mov)(\?.*)?$/i;

const optionalText = (label: string, max: number) =>
	v.optional(
		v.pipe(
			v.nullable(v.string(`${label} must be a string`)),
			v.transform((value) => value?.trim() || null),
			v.check(
				(value) => value === null || value.length <= max,
				`${label} cannot exceed ${max} characters`
			)
		),
		null
	);

const CreateStoryBody = v.object(
	{
		mediaUrl: v.pipe(v.string('Media is required'), v.trim(), v.minLength(1, 'Media is required')),
		mediaType: v.optional(v.picklist(['image', 'video'], 'Invalid media type')),
		caption: optionalText('Caption', MAX_STORY_CAPTION),
		location: optionalText('Location', MAX_STORY_LOCATION)
	},
	'Request body must be an object'
);

function storiesKv(platform: App.Platform | undefined): KVNamespace | null {
	return platform?.env?.STORIES ?? null;
}

/** Shares a story that disappears after 24 hours (KV expirationTtl). */
export const POST: RequestHandler = withApi(async ({ request, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'createStory', currentUser.id);
	const body = await parseBody(request, CreateStoryBody);

	// Only media this user uploaded through the presign flow into their stories folder.
	const key = extractR2Key(body.mediaUrl);
	if (!key?.startsWith(`stories/${currentUser.id}/`)) {
		const message = 'Upload the story media first';
		throw new ApiError(400, 'validation_failed', message, { mediaUrl: message });
	}

	const kv = storiesKv(platform);
	if (!kv) {
		// Bindings are read at startup: a dev server started before STORIES was added lacks it.
		console.error(
			'STORIES KV binding is missing. Check wrangler.jsonc and restart the dev server.'
		);
		throw new ApiError(503, 'stories_unavailable', 'Stories are not available right now');
	}

	const story = await putStory(kv, {
		userId: currentUser.id,
		mediaUrl: body.mediaUrl,
		mediaType: body.mediaType ?? (VIDEO_URL.test(body.mediaUrl) ? 'video' : 'image'),
		caption: body.caption,
		location: body.location
	});

	return json(
		{ story: { ...story, mediaUrl: await refreshMediaUrl(story.mediaUrl, platform?.env) } },
		{ status: 201 }
	);
});

/**
 * Active stories from the people the viewer follows plus their own, grouped by user:
 * own group first, then the most recently updated. Signed-out viewers get an empty list.
 */
export const GET: RequestHandler = withApi(async ({ locals, platform }) => {
	const viewer = locals.user;
	const kv = storiesKv(platform);
	if (!viewer || !kv) return json({ groups: [] });

	// Most recently followed first, so the cap keeps the people you care about most.
	const followed = await locals.db
		.select({ id: userFollow.followingId })
		.from(userFollow)
		.where(eq(userFollow.followerId, viewer.id))
		.orderBy(desc(userFollow.createdAt))
		.limit(MAX_STORY_AUTHORS - 1);

	const byUser = await listStoriesByUser(kv, [viewer.id, ...followed.map((f) => f.id)]);
	if (byUser.size === 0) return json({ groups: [] });

	// One read for the viewer's watched stories; view counts only for their own (few) stories.
	const [seen, ownViewCounts] = await Promise.all([
		getSeenStoryIds(kv, viewer.id),
		Promise.all(
			(byUser.get(viewer.id) ?? []).map(
				async (s) => [s.id, (await listViews(kv, s.id)).length] as const
			)
		).then((pairs) => new Map(pairs))
	]);

	const authors = await locals.db
		.select({ id: user.id, name: user.name, handle: user.handle, image: user.image })
		.from(user)
		.where(inArray(user.id, [...byUser.keys()]));

	const env = platform?.env;
	const groups = await Promise.all(
		authors.map(async (author) => {
			const stories = byUser.get(author.id) ?? [];
			return {
				user: {
					...author,
					image: author.image ? await refreshMediaUrl(author.image, env) : null
				},
				isSelf: author.id === viewer.id,
				latestAt: stories.at(-1)?.createdAt ?? 0,
				stories: await Promise.all(
					stories.map(async (s) => ({
						...s,
						mediaUrl: await refreshMediaUrl(s.mediaUrl, env),
						// Your own stories always count as watched.
						seen: author.id === viewer.id || seen.has(s.id),
						...(author.id === viewer.id ? { viewCount: ownViewCounts.get(s.id) ?? 0 } : {})
					}))
				)
			};
		})
	);

	groups.sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || b.latestAt - a.latestAt);
	return json({ groups });
});
