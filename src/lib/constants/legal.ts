import { m } from '$lib/i18n';

/**
 * Operator details shown on the legal pages. These are placeholders: replace them with the
 * real operator name, contact address and jurisdiction before launch.
 */
export const OPERATOR_NAME = 'Kizuna';
export const CONTACT_EMAIL = 'privacy@kizuna.example';
export const MIN_AGE = 13;
export const LEGAL_LAST_UPDATED = '30 September 2026';

export const LEGAL_LINKS = [
	{ href: '/legal/terms', label: m.legal_terms_label(), title: m.legal_terms_title() },
	{ href: '/legal/privacy', label: m.legal_privacy_label(), title: m.legal_privacy_title() },
	{ href: '/legal/cookies', label: m.legal_cookies_label(), title: m.legal_cookies_title() },
	{
		href: '/legal/guidelines',
		label: m.legal_guidelines_label(),
		title: m.legal_guidelines_title()
	},
	{ href: '/about', label: m.legal_about_label(), title: m.legal_about_title() }
] as const;
