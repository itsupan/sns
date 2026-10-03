import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { isOwnUpload, refreshMediaUrl } from '$lib/server/services/storage';
import { ApiError, enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';
import {
	MAX_STORY_CAPTION,
	MAX_STORY_LOCATION,
	createStory,
	loadTrayStories,
	type TrayStory
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

/** Shares a story that disappears after 24 hours. */
export const POST: RequestHandler = withApi(async ({ request, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'createStory', currentUser.id);
	const body = await parseBody(request, CreateStoryBody);

	// Only media this user uploaded through the presign flow into their stories folder.
	if (!isOwnUpload(body.mediaUrl, 'stories', currentUser.id, platform?.env)) {
		const message = 'Upload the story media first';
		throw new ApiError(400, 'validation_failed', message, { mediaUrl: message });
	}

	const story = await createStory(locals.db, {
		userId: currentUser.id,
		mediaUrl: body.mediaUrl,
		mediaType: body.mediaType ?? (VIDEO_URL.test(body.mediaUrl) ? 'video' : 'image'),
		caption: body.caption,
		location: body.location
	});
	if (!story) {
		throw new ApiError(409, 'duplicate_story', 'A story was just shared. Try again.');
	}

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
	if (!viewer) return json({ groups: [] });

	const env = platform?.env;
	const byUser = new Map<
		string,
		{ user: TrayStory['author']; stories: Omit<TrayStory, 'author'>[] }
	>();
	for (const { author, ...story } of await loadTrayStories(locals.db, viewer.id)) {
		const group = byUser.get(author.id) ?? { user: author, stories: [] };
		group.stories.push(story);
		byUser.set(author.id, group);
	}

	const groups = await Promise.all(
		[...byUser.values()].map(async ({ user, stories }) => {
			const isSelf = user.id === viewer.id;
			// Loaded newest first; viewing order is oldest first.
			stories.reverse();
			return {
				user: { ...user, image: user.image ? await refreshMediaUrl(user.image, env) : null },
				isSelf,
				latestAt: stories.at(-1)?.createdAt ?? 0,
				stories: await Promise.all(
					stories.map(async ({ viewsCount, seen, reaction, ...s }) => ({
						...s,
						mediaUrl: await refreshMediaUrl(s.mediaUrl, env),
						// Your own stories always count as watched.
						seen: isSelf || seen,
						...(isSelf ? { viewCount: viewsCount } : { reaction })
					}))
				)
			};
		})
	);

	groups.sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || b.latestAt - a.latestAt);
	return json({ groups });
});
