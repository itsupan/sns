import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { PageServerLoad } from './$types';
import { getConfig } from '$lib/server/config';
import { refreshMediaUrl } from '$lib/server/services/storage';
import { loadArchivePage, withSignedMedia } from '$lib/server/stories';

// Story dates show in the viewer's time zone, which only the browser knows.
export const ssr = false;

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	if (!locals.user) {
		throw redirect(302, `${resolve('/login')}?redirectTo=${encodeURIComponent(url.pathname)}`);
	}
	const env = platform?.env;
	const { id, name, handle, image } = locals.user;
	const page = await loadArchivePage(locals.db, id, {
		limit: getConfig(env).storyArchive.defaultPageSize,
		cursor: null
	});
	return {
		user: {
			id,
			name,
			handle: handle ?? null,
			image: image ? await refreshMediaUrl(image, env) : null
		},
		stories: await withSignedMedia(page.stories, env),
		nextCursor: page.nextCursor
	};
};
