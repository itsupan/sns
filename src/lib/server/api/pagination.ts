import * as v from 'valibot';
import type { PageSize } from '$lib/server/config';
import { decodeCursor, type FeedCursor } from '$lib/server/db/posts';
import { ApiError } from './errors';
import { parseQuery } from './validation';

/**
 * Reads `limit` (1..maxPageSize, default defaultPageSize) and an optional keyset `cursor`
 * from the query string; throws a 400 `ApiError` when either is invalid.
 */
export async function parsePageQuery(
	url: URL,
	{ defaultPageSize, maxPageSize }: PageSize
): Promise<{ limit: number; cursor: FeedCursor | null }> {
	const query = await parseQuery(
		url,
		v.object({
			limit: v.optional(
				v.pipe(
					v.string(),
					v.toNumber('Limit must be a number'),
					v.integer('Limit must be a whole number'),
					v.minValue(1, 'Limit must be at least 1'),
					v.maxValue(maxPageSize, `Limit cannot exceed ${maxPageSize}`)
				),
				String(defaultPageSize)
			),
			cursor: v.optional(v.string())
		})
	);
	const cursor = query.cursor ? decodeCursor(query.cursor) : null;
	if (query.cursor && !cursor) {
		throw new ApiError(400, 'validation_failed', 'Invalid cursor', { cursor: 'Invalid cursor' });
	}
	return { limit: query.limit, cursor };
}
