import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { enforceRateLimit, parseBody, parsePageQuery, requireUser, withApi } from '$lib/server/api';
import { getConfig } from '$lib/server/config';
import { getOrCreateDm, listInbox } from '$lib/server/db/chat';
import { refreshMediaUrl } from '$lib/server/services/storage';

const StartDm = v.object({
	userId: v.pipe(v.string('User is required'), v.trim(), v.minLength(1, 'User is required'))
});

/** The viewer's conversations, most recent message first. Query: `limit`, `cursor`. */
export const GET: RequestHandler = withApi(async ({ url, locals, platform }) => {
	const viewer = requireUser(locals);
	const { limit, cursor } = await parsePageQuery(url, getConfig(platform?.env).chat.inbox);
	const page = await listInbox(locals.db, { userId: viewer.id, limit, cursor });
	const conversations = await Promise.all(
		page.conversations.map(async (c) => ({
			...c,
			other: {
				...c.other,
				image: c.other.image ? await refreshMediaUrl(c.other.image, platform?.env) : null
			}
		}))
	);
	return json({ conversations, hasMore: page.hasMore, nextCursor: page.nextCursor });
});

/** Opens the direct conversation with `userId`, creating it on first use (201) or returning it (200). */
export const POST: RequestHandler = withApi(async ({ request, locals, platform }) => {
	const viewer = requireUser(locals);
	await enforceRateLimit(platform, 'chatStart', viewer.id);
	const { userId } = await parseBody(request, StartDm);
	const dm = await getOrCreateDm(locals.db, viewer.id, userId);
	return json({ conversation: { id: dm.id, other: dm.other } }, { status: dm.created ? 201 : 200 });
});
