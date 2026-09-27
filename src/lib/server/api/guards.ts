import { ApiError } from './errors';

/** Returns the signed-in user, or throws a 401 `ApiError`. */
export function requireUser(locals: App.Locals): NonNullable<App.Locals['user']> {
	if (!locals.user) {
		throw new ApiError(401, 'unauthorized', 'You must be signed in');
	}
	return locals.user;
}
