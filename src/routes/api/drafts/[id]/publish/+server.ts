import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ApiError, enforceRateLimit, requireUser, withApi } from '$lib/server/api';
import { publishDraft, requireOwnDraft } from '$lib/server/posts/drafts';

/** Publish now. It creates a post, so it counts against `createPost` as POST /api/posts does. */
export const POST: RequestHandler = withApi(async ({ params, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'createPost', currentUser.id);
	const draft = await requireOwnDraft(locals.db, currentUser.id, params.id);

	const post = await publishDraft(locals.db, platform, draft);
	if (!post) {
		throw new ApiError(409, 'conflict', 'This draft just changed; reload and try again');
	}
	return json({ post }, { status: 201 });
});
