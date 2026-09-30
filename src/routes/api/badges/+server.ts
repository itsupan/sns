import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser, withApi } from '$lib/server/api';
import { countUnread } from '$lib/server/db/chat';
import { countUnreadNotifications } from '$lib/server/db/notifications';

/** Header and nav badges in one request: unread messages and unread activity. */
export const GET: RequestHandler = withApi(async ({ locals }) => {
	const viewer = requireUser(locals);
	const [messages, activity] = await Promise.all([
		countUnread(locals.db, viewer.id),
		countUnreadNotifications(locals.db, viewer.id)
	]);
	return json({ messages, activity });
});
