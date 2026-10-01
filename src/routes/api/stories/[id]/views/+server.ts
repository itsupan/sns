import { json } from '@sveltejs/kit';
import { inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { user } from '$lib/server/db/schema';
import { ApiError, requireUser, withApi } from '$lib/server/api';
import { loadFollowedIds } from '$lib/server/db/follows';
import { refreshMediaUrl } from '$lib/server/services/storage';
import { getStory, listViews, parseStoryId } from '$lib/server/stories';

/** Who watched your story, most recent first, with any reaction they sent. Author only. */
export const GET: RequestHandler = withApi(async ({ params, locals, platform }) => {
	const currentUser = requireUser(locals);
	const id = params.id ?? '';
	const parsed = parseStoryId(id);
	if (!parsed) {
		throw new ApiError(400, 'validation_failed', 'Invalid story id');
	}
	if (parsed.userId !== currentUser.id) {
		throw new ApiError(403, 'forbidden', 'Only the author can see who viewed a story');
	}
	const kv = platform?.env?.STORIES;
	if (!kv) {
		throw new ApiError(503, 'stories_unavailable', 'Stories are not available right now');
	}
	if (!(await getStory(kv, id))) {
		throw new ApiError(404, 'not_found', 'Story not found');
	}

	const views = await listViews(kv, id);
	const ids = views.map((v) => v.viewerId);
	const [people, followed] = await Promise.all([
		ids.length > 0
			? locals.db
					.select({ id: user.id, name: user.name, handle: user.handle, image: user.image })
					.from(user)
					.where(inArray(user.id, ids))
			: Promise.resolve([]),
		loadFollowedIds(locals.db, currentUser.id, ids)
	]);
	const byId = new Map(people.map((p) => [p.id, p]));

	const viewers = await Promise.all(
		views
			.filter((v) => byId.has(v.viewerId)) // accounts deleted since viewing drop out
			.map(async (v) => {
				const person = byId.get(v.viewerId)!;
				return {
					...person,
					image: person.image ? await refreshMediaUrl(person.image, platform?.env) : null,
					viewedAt: v.viewedAt,
					reaction: v.reaction ?? null,
					isFollowing: followed.has(v.viewerId)
				};
			})
	);

	return json({ count: viewers.length, viewers });
});
