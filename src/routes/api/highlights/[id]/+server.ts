import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { MAX_HIGHLIGHT_ITEMS } from '$lib/highlights';
import { ApiError, enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';
import { HighlightTitle, StoryId } from '$lib/server/api/highlights';
import { deleteHighlight, updateHighlight } from '$lib/server/highlights';

/** Omitted fields stay as they are; a null cover falls back to the first story. */
const UpdateHighlightBody = v.object(
	{
		title: v.optional(HighlightTitle),
		coverStoryId: v.optional(v.nullable(StoryId)),
		storyIds: v.optional(
			v.pipe(
				v.array(StoryId, 'Stories must be a list'),
				v.maxLength(
					MAX_HIGHLIGHT_ITEMS,
					`A highlight can hold at most ${MAX_HIGHLIGHT_ITEMS} stories`
				),
				v.check((ids) => new Set(ids).size === ids.length, 'Stories must not repeat')
			)
		)
	},
	'Request body must be an object'
);

/**
 * Edits one of your highlights: renames it, picks its cover, or with `storyIds` (the stories to
 * keep, in order) reorders and removes stories.
 */
export const PATCH: RequestHandler = withApi(async ({ params, request, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'highlight', currentUser.id);
	const body = await parseBody(request, UpdateHighlightBody);
	if (Object.values(body).every((value) => value === undefined)) {
		throw new ApiError(400, 'validation_failed', 'No valid fields provided to update');
	}
	await updateHighlight(locals.db, currentUser.id, params.id, body);
	return new Response(null, { status: 204 });
});

/** Deletes one of your highlights; its stories stay in your archive. Idempotent. */
export const DELETE: RequestHandler = withApi(async ({ params, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'highlight', currentUser.id);
	await deleteHighlight(locals.db, currentUser.id, params.id);
	return new Response(null, { status: 204 });
});
