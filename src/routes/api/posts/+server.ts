import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { refreshPostMediaUrls } from '$lib/server/services/storage';
import { getConfig } from '$lib/server/config';
import { ApiError, enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';
import { decodeCursor, loadFeedPage } from '$lib/server/db/posts';
import { toPostCards } from '$lib/server/db/post-cards';
import { createPost } from '$lib/server/posts/create';

// Kept loose on purpose: `createPost` tolerates legacy/partial media and tag payloads.
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
	const created = await createPost(locals.db, platform, currentUser.id, body);
	return json({ post: created }, { status: 201 });
});
