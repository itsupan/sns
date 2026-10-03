/** better-auth's default minimum, which the server enforces as well. */
export const MIN_PASSWORD_LENGTH = 8;

/** Why a new password and its confirmation cannot be used, or `null` when they can. */
export function newPasswordError(password: string, confirmation: string): string | null {
	if (password.length < MIN_PASSWORD_LENGTH) {
		return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
	}
	if (!confirmation) return 'Please confirm your password.';
	if (password !== confirmation) return 'Passwords do not match.';
	return null;
}
