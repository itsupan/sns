import type { RequestHandler } from './$types';
import { followListHandler } from '$lib/server/api/follow-list';

/** Who follows `:id`, newest first. Query: `limit` (1-50, default 20), `cursor`. */
export const GET: RequestHandler = followListHandler('followers');
