import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { isAdmin, isModerator } from '$lib/server/roles';

/** Moderation pages answer 404 to everyone but moderators and admins, so they stay hidden. */
export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.user || !isModerator(locals.user)) throw error(404, 'Not found');
	return { isAdmin: isAdmin(locals.user) };
};
