import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, resolve('/login'));
	}

	return {
		user: {
			id: locals.user.id,
			name: locals.user.name,
			email: locals.user.email,
			image: locals.user.image,
			handle: (locals.user as { handle?: string | null }).handle ?? null,
			title: (locals.user as { title?: string | null }).title ?? null,
			bio: (locals.user as { bio?: string | null }).bio ?? null,
			website: (locals.user as { website?: string | null }).website ?? null,
			location: (locals.user as { location?: string | null }).location ?? null,
			cameraGear: (locals.user as { cameraGear?: string | null }).cameraGear ?? null
		}
	};
};
