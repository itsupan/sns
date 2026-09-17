import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

describe('home page', () => {
	it('shows the app name', async () => {
		const screen = render(Page);

		await expect.element(screen.getByRole('heading', { level: 1 })).toHaveTextContent('sns');
	});
});
