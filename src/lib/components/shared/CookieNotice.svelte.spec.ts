import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CookieNotice, { COOKIE_NOTICE_KEY } from './CookieNotice.svelte';

describe('CookieNotice', () => {
	afterEach(() => localStorage.removeItem(COOKIE_NOTICE_KEY));

	it('shows the notice until it is dismissed, and remembers the choice', async () => {
		const screen = await render(CookieNotice);
		const notice = screen.getByRole('region', { name: 'Cookie notice' });
		await expect.element(notice).toBeInTheDocument();
		await expect
			.element(screen.getByRole('link', { name: 'Cookie Policy' }))
			.toHaveAttribute('href', '/legal/cookies');

		await screen.getByRole('button', { name: 'OK' }).click();
		await expect.element(notice).not.toBeInTheDocument();
		expect(localStorage.getItem(COOKIE_NOTICE_KEY)).toBe('dismissed');
	});

	it('stays hidden once dismissed', async () => {
		localStorage.setItem(COOKIE_NOTICE_KEY, 'dismissed');
		const screen = await render(CookieNotice);
		await expect
			.element(screen.getByRole('region', { name: 'Cookie notice' }))
			.not.toBeInTheDocument();
	});
});
