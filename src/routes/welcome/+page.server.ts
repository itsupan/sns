import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { PageServerLoad } from './$types';
import { suggestHandle } from '$lib/server/db/handles';
import { loadSuggestions } from '$lib/server/explore';
import { sameOriginPath } from '$lib/utils/redirect';

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	const me = locals.user;
	if (!me) {
		throw redirect(
			302,
			`${resolve('/login')}?redirectTo=${encodeURIComponent(url.pathname + url.search)}`
		);
	}

	const target = sameOriginPath(url.searchParams.get('redirectTo'), url.origin);
	const redirectTo = new URL(target, url.origin).pathname === url.pathname ? '/' : target;
	if (me.onboardedAt) throw redirect(302, redirectTo);

	const [suggestedHandle, suggestions] = await Promise.all([
		me.handle ?? suggestHandle(locals.db, me.name, me.id),
		loadSuggestions(locals.db, me.id, platform?.env)
	]);

	return {
		user: {
			id: me.id,
			name: me.name,
			handle: me.handle ?? null,
			image: me.image ?? null,
			bio: me.bio ?? null
		},
		suggestedHandle,
		suggestions,
		redirectTo
	};
};
