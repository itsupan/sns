import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { PageServerLoad } from './$types';
import { getConfig } from '$lib/server/config';
import { listInbox } from '$lib/server/db/chat';
import { withFreshAvatar } from '$lib/server/chat/avatars';

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	if (!locals.user) {
		throw redirect(302, `${resolve('/login')}?redirectTo=${encodeURIComponent(url.pathname)}`);
	}
	const page = await listInbox(locals.db, {
		userId: locals.user.id,
		limit: getConfig(platform?.env).chat.inbox.defaultPageSize
	});
	return {
		viewerId: locals.user.id,
		conversations: await Promise.all(
			page.conversations.map(async (c) => ({
				...c,
				other: await withFreshAvatar(c.other, platform?.env)
			}))
		),
		nextCursor: page.nextCursor
	};
};
