import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { markNotificationsRead } from '$lib/server/db/notifications';
import { enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';

const MarkRead = v.object({
	/** Epoch ms of the newest notification the viewer has seen; later ones stay unread. */
	upTo: v.pipe(
		v.number('upTo must be a timestamp'),
		v.integer('upTo must be a timestamp'),
		v.minValue(0, 'upTo must be a timestamp')
	)
});

/** Marks notifications up to `upTo` as read. The marker only moves forward. */
export const POST: RequestHandler = withApi(async ({ request, locals, platform }) => {
	const viewer = requireUser(locals);
	await enforceRateLimit(platform, 'markRead', viewer.id);
	const { upTo } = await parseBody(request, MarkRead);
	// Never beyond now, so a bad clock cannot mark future activity read.
	await markNotificationsRead(locals.db, viewer.id, new Date(Math.min(upTo, Date.now())));
	return json({ ok: true });
});
