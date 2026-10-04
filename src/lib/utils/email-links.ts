import { resolve } from '$app/paths';

/*
 * Links in verification and email-change emails return to Settings with the outcome in the query.
 * better-auth appends `error=<CODE>` when a link is invalid or expired.
 */

export const emailVerifiedUrl = `${resolve('/settings')}?verified=1`;

export function emailChangedUrl(newEmail: string): string {
	return `${resolve('/settings')}?newEmail=${encodeURIComponent(newEmail)}`;
}

const LINK_ERRORS: Record<string, string> = {
	TOKEN_EXPIRED: 'This link has expired. Request a new one.',
	INVALID_USER: 'This link is for a different account.'
};

export interface EmailLinkResult {
	type: 'success' | 'error';
	text: string;
}

/** What to tell someone who arrived from an email link, or `null` if they did not. */
export function emailLinkResult(params: URLSearchParams, email: string): EmailLinkResult | null {
	const error = params.get('error');
	if (error) return { type: 'error', text: LINK_ERRORS[error] ?? 'This link is invalid.' };
	if (params.has('verified')) return { type: 'success', text: 'Your email is verified' };
	const newEmail = params.get('newEmail');
	if (!newEmail) return null;
	// A verified account moves in two steps that share this URL: approve from the current address,
	// then confirm from the new one.
	return newEmail.toLowerCase() === email.toLowerCase()
		? { type: 'success', text: `Your email is now ${newEmail}` }
		: { type: 'success', text: `Approved. Open the link we sent to ${newEmail} to finish.` };
}
