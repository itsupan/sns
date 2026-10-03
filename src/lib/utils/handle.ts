/** A stored handle: lowercase, without the `@`. */
export const HANDLE_PATTERN = /^[a-z0-9_.-]{1,30}$/;

export const HANDLE_RULES =
	'Handle must be 1-30 characters and can only contain letters, numbers, dots, and underscores';

/** What someone typed as a handle, in stored form: trimmed, no leading `@`, lowercase. */
export function normalizeHandle(value: string): string {
	return value.trim().replace(/^@/, '').toLowerCase();
}

/** A valid handle built from a display name ("Élena Vance" becomes `elena.vance`), or `''`. */
export function handleFromName(name: string): string {
	return name
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '.')
		.replace(/[^a-z0-9_.-]/g, '')
		.replace(/\.{2,}/g, '.')
		.replace(/^\.+|\.+$/g, '')
		.slice(0, 30)
		.replace(/\.+$/, '');
}
