import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import ErrorPage from './+error.svelte';

describe('Error Page', () => {
	it('renders 404 page with recovery links', async () => {
		const screen = await render(ErrorPage);

		await expect.element(screen.getByText('404')).toBeInTheDocument();
		await expect
			.element(screen.getByText('Page Not Found · ページが見つかりません'))
			.toBeInTheDocument();
		await expect.element(screen.getByText('Return to Feed')).toBeInTheDocument();
		await expect.element(screen.getByText('Go to Profile')).toBeInTheDocument();
	});
});
