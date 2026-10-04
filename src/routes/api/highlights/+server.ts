import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';
import { createHighlight } from '$lib/server/highlights';
import { HighlightTitle, StoryId } from '$lib/server/api/highlights';

const CreateHighlightBody = v.object(
	{ title: HighlightTitle, storyId: StoryId },
	'Request body must be an object'
);

/** Starts a highlight on your profile with one of your stories, live or expired. */
export const POST: RequestHandler = withApi(async ({ request, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'highlight', currentUser.id);
	const { title, storyId } = await parseBody(request, CreateHighlightBody);
	const highlight = await createHighlight(locals.db, currentUser.id, title, storyId);
	return json({ highlight }, { status: 201 });
});
