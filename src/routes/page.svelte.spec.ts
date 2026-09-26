import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

describe('home page', () => {
	it('shows the app name and feed layout components', async () => {
		const screen = render(Page);

		await expect
			.element(screen.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Kizuna home feed');
		await expect
			.element(screen.getByText('Quiet Brutalism: Concrete Light & Shadows'))
			.toBeInTheDocument();
		await expect.element(screen.getByText('Your story')).toBeInTheDocument();
		await expect.element(screen.getByText('Curators to Follow')).toBeInTheDocument();
	});
});
