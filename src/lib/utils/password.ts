import { m } from '$lib/i18n';

/** better-auth's default minimum, which the server enforces as well. */
export const MIN_PASSWORD_LENGTH = 8;

/** Why a new password and its confirmation cannot be used, or `null` when they can. */
export function newPasswordError(password: string, confirmation: string): string | null {
	if (password.length < MIN_PASSWORD_LENGTH) {
		return m.auth_password_too_short(MIN_PASSWORD_LENGTH);
	}
	if (!confirmation) return m.auth_password_confirm();
	if (password !== confirmation) return m.auth_password_mismatch();
	return null;
}
