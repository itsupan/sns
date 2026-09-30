/**
 * Operator details shown on the legal pages. These are placeholders: replace them with the
 * real operator name, contact address and jurisdiction before launch.
 */
export const OPERATOR_NAME = 'Kizuna';
export const CONTACT_EMAIL = 'privacy@kizuna.example';
export const MIN_AGE = 13;
export const LEGAL_LAST_UPDATED = '30 September 2026';

export const LEGAL_LINKS = [
	{ href: '/legal/terms', label: 'Terms' },
	{ href: '/legal/privacy', label: 'Privacy' },
	{ href: '/legal/cookies', label: 'Cookies' },
	{ href: '/legal/guidelines', label: 'Guidelines' },
	{ href: '/about', label: 'About' }
] as const;
