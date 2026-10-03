import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { readable } from 'svelte/store';
import Header from './Header.svelte';
// The account link and the phone search screen each show at their own widths.
import '../../../app.css';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));

// Signed in, with no handle picked yet.
vi.mock('$lib/auth-client', () => ({
	authClient: {
		useSession: () =>
			readable({
				data: {
					user: {
						id: 'u-marcus',
						name: 'Marcus Chen',
						email: 'marcus.chen@example.com',
						handle: null,
						image: null
					}
				},
				isPending: false
			})
	}
}));

describe('Header', () => {
	it('never shows a handle taken from the email', async () => {
		await page.viewport(1280, 900);
		const screen = render(Header);
		await expect.element(screen.getByText('Marcus Chen')).toBeVisible();
		await expect.element(screen.getByText('@marcuschen')).toBeVisible();
		expect(document.body.textContent).not.toContain('marcus.chen');
	});

	it('opens search full screen on phones, focused on the input, until Escape or Back', async () => {
		await page.viewport(390, 800);
		const screen = render(Header);
		const open = screen.getByRole('button', { name: 'Search', exact: true });

		await open.click();
		const search = screen.getByRole('dialog', { name: 'Search' });
		const input = search.getByRole('combobox', { name: 'Search creators and posts' });
		await expect.element(input).toHaveFocus();

		// A tap on the empty screen below the search bar is not a backdrop tap.
		await search.click({ position: { x: 195, y: 500 } });
		await expect.element(search).toBeVisible();

		// Escape closes the open suggestions first.
		await input.fill('k');
		await expect.element(input).toHaveAttribute('aria-expanded', 'true');
		await userEvent.keyboard('{Escape}');
		await expect.element(input).toHaveAttribute('aria-expanded', 'false');
		await expect.element(search).toBeVisible();

		await userEvent.keyboard('{Escape}');
		await expect.element(search).not.toBeInTheDocument();
		await expect.element(open).toHaveFocus();

		await open.click();
		await screen.getByRole('button', { name: 'Close search' }).click();
		await expect.element(search).not.toBeInTheDocument();
		await expect.element(open).toHaveFocus();
	});
});
