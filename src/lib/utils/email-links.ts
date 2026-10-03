import { resolve } from '$app/paths';
import { m } from '$lib/i18n';

/*
 * Links in verification and email-change emails return to Settings with the outcome in the query.
 * better-auth appends `error=<CODE>` when a link is invalid or expired.
 */

export const emailVerifiedUrl = `${resolve('/settings')}?verified=1`;

export function emailChangedUrl(newEmail: string): string {
	return `${resolve('/settings')}?newEmail=${encodeURIComponent(newEmail)}`;
}

const LINK_ERRORS: Record<string, string> = {
	TOKEN_EXPIRED: m.settings_link_expired(),
	INVALID_USER: m.settings_link_wrong_account()
};

export interface EmailLinkResult {
	type: 'success' | 'error';
	text: string;
}

/** What to tell someone who arrived from an email link, or `null` if they did not. */
export function emailLinkResult(params: URLSearchParams, email: string): EmailLinkResult | null {
	const error = params.get('error');
	if (error) return { type: 'error', text: LINK_ERRORS[error] ?? m.settings_link_invalid() };
	if (params.has('verified')) return { type: 'success', text: m.settings_email_now_verified() };
	const newEmail = params.get('newEmail');
	if (!newEmail) return null;
	// A verified account moves in two steps that share this URL: approve from the current address,
	// then confirm from the new one.
	return newEmail.toLowerCase() === email.toLowerCase()
		? { type: 'success', text: m.settings_email_now(newEmail) }
		: { type: 'success', text: m.settings_email_approved(newEmail) };
}
