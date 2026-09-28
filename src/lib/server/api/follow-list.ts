import { json, type RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import * as v from 'valibot';
import { user } from '$lib/server/db/schema';
import { decodeCursor } from '$lib/server/db/posts';
import { FOLLOW_MAX_PAGE_SIZE, FOLLOW_PAGE_SIZE, listFollows } from '$lib/server/db/follows';
import { refreshMediaUrl } from '$lib/server/services/storage';
import { ApiError, withApi } from './errors';
import { parseQuery } from './validation';

const ListQuery = v.object({
	limit: v.optional(
		v.pipe(
			v.string(),
			v.toNumber('Limit must be a number'),
			v.integer('Limit must be a whole number'),
			v.minValue(1, 'Limit must be at least 1'),
			v.maxValue(FOLLOW_MAX_PAGE_SIZE, `Limit cannot exceed ${FOLLOW_MAX_PAGE_SIZE}`)
		),
		String(FOLLOW_PAGE_SIZE)
	),
	cursor: v.optional(v.string())
});

/** GET handler for `/api/users/:id/followers` and `/following`: cursor-paginated user list. */
export function followListHandler(direction: 'followers' | 'following') {
	return withApi(async ({ params, url, locals, platform }: RequestEvent) => {
		const userId = params.id;
		if (!userId) {
			throw new ApiError(400, 'validation_failed', 'User ID is required');
		}
		const query = await parseQuery(url, ListQuery);
		const cursor = query.cursor ? decodeCursor(query.cursor) : null;
		if (query.cursor && !cursor) {
			throw new ApiError(400, 'validation_failed', 'Invalid cursor', { cursor: 'Invalid cursor' });
		}

		const exists = await locals.db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		if (exists.length === 0) {
			throw new ApiError(404, 'not_found', 'User not found');
		}

		const page = await listFollows(locals.db, {
			userId,
			direction,
			viewerId: locals.user?.id ?? null,
			limit: query.limit,
			cursor
		});

		const users = await Promise.all(
			page.users.map(async (u) => ({
				...u,
				image: u.image ? await refreshMediaUrl(u.image, platform?.env) : null
			}))
		);

		return json({ users, hasMore: page.hasMore, nextCursor: page.nextCursor });
	});
}
