/**
 * Operator details shown on the legal pages. These are placeholders: replace them with the
 * real operator name, contact address and jurisdiction before launch.
 */
export const OPERATOR_NAME = 'Kizuna';
export const CONTACT_EMAIL = 'privacy@kizuna.example';
export const MIN_AGE = 13;
export const LEGAL_LAST_UPDATED = '30 September 2026';

export const LEGAL_LINKS = [
	{ href: '/legal/terms', label: 'Terms', title: 'Terms of Service' },
	{ href: '/legal/privacy', label: 'Privacy', title: 'Privacy Policy' },
	{ href: '/legal/cookies', label: 'Cookies', title: 'Cookie Policy' },
	{ href: '/legal/guidelines', label: 'Guidelines', title: 'Community Guidelines' },
	{ href: '/about', label: 'About', title: 'About Kizuna' }
] as const;
