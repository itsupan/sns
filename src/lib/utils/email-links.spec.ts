import { describe, expect, it } from 'vitest';
import { emailChangedUrl, emailLinkResult, emailVerifiedUrl } from './email-links';

const result = (url: string, email = 'ada@example.com') =>
	emailLinkResult(new URL(url, 'http://localhost').searchParams, email);

describe('emailLinkResult', () => {
	it('confirms a verified email', () => {
		expect(result(emailVerifiedUrl)).toEqual({ type: 'success', text: 'Your email is verified' });
	});

	it('tells the two steps of an email change apart by the current address', () => {
		const url = emailChangedUrl('new@example.com');
		expect(result(url)).toEqual({
			type: 'success',
			text: 'Approved. Open the link we sent to new@example.com to finish.'
		});
		expect(result(url, 'new@example.com')).toEqual({
			type: 'success',
			text: 'Your email is now new@example.com'
		});
	});

	it('reports the error better-auth appends to a bad link', () => {
		expect(result(`${emailVerifiedUrl}&error=TOKEN_EXPIRED`)).toEqual({
			type: 'error',
			text: 'This link has expired. Request a new one.'
		});
		expect(result(`${emailVerifiedUrl}&error=INVALID_TOKEN`)).toMatchObject({ type: 'error' });
	});

	it('ignores a plain visit', () => {
		expect(result('/settings')).toBeNull();
	});
});
