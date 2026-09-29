import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser, withApi } from '$lib/server/api';
import { countUnread } from '$lib/server/db/chat';

/** Unread direct messages across all conversations (header badge). */
export const GET: RequestHandler = withApi(async ({ locals }) => {
	const viewer = requireUser(locals);
	return json({ unread: await countUnread(locals.db, viewer.id) });
});
