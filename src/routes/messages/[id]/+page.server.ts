import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { PageServerLoad } from './$types';
import { ApiError } from '$lib/server/api';
import { getConfig } from '$lib/server/config';
import { listMessages, markRead, requireMembership } from '$lib/server/db/chat';
import { withFreshAvatar } from '$lib/server/chat/avatars';

export const load: PageServerLoad = async ({ locals, params, platform, url }) => {
	if (!locals.user) {
		throw redirect(302, `${resolve('/login')}?redirectTo=${encodeURIComponent(url.pathname)}`);
	}
	let conversation;
	try {
		conversation = await requireMembership(locals.db, params.id, locals.user.id);
	} catch (err) {
		if (err instanceof ApiError && err.status === 404) throw error(404, 'Conversation not found');
		throw err;
	}
	const [history] = await Promise.all([
		listMessages(locals.db, {
			conversationId: params.id,
			limit: getConfig(platform?.env).chat.messages.defaultPageSize
		}),
		markRead(locals.db, params.id, locals.user.id)
	]);
	return {
		viewerId: locals.user.id,
		conversation: {
			id: conversation.id,
			other: await withFreshAvatar(conversation.other, platform?.env)
		},
		messages: history.messages,
		nextCursor: history.nextCursor
	};
};
