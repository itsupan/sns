import { ApiError } from './errors';
import { isAdmin, isModerator } from '$lib/server/roles';

/** Returns the signed-in user, or throws a 401 `ApiError`. */
export function requireUser(locals: App.Locals): NonNullable<App.Locals['user']> {
	if (!locals.user) {
		throw new ApiError(401, 'unauthorized', 'You must be signed in');
	}
	return locals.user;
}

/** Returns the signed-in moderator or admin; anyone else gets a 404, so `/api/admin` stays hidden. */
export function requireModerator(locals: App.Locals): NonNullable<App.Locals['user']> {
	const user = requireUser(locals);
	if (!isModerator(user)) throw new ApiError(404, 'not_found', 'Not found');
	return user;
}

/** Returns the signed-in admin; moderators get a 403, everyone else a 404. */
export function requireAdmin(locals: App.Locals): NonNullable<App.Locals['user']> {
	const user = requireModerator(locals);
	if (!isAdmin(user)) throw new ApiError(403, 'forbidden', 'Only admins can do this');
	return user;
}
