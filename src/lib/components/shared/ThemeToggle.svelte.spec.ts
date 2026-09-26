import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import ThemeToggle from './ThemeToggle.svelte';
import { themeManager } from '$lib/utils/theme.svelte';

describe('ThemeToggle component', () => {
	it('renders icon button with accessible label', async () => {
		const screen = render(ThemeToggle);
		const btn = screen.getByRole('button');

		await expect.element(btn).toBeInTheDocument();
		await expect.element(btn).toHaveClass('theme-toggle');
	});

	it('renders segmented mode when requested', async () => {
		const screen = render(ThemeToggle, { variant: 'segmented' });
		const group = screen.getByRole('radiogroup', { name: 'Theme mode' });

		await expect.element(group).toBeInTheDocument();
		await expect.element(screen.getByRole('radio', { name: 'Light' })).toBeInTheDocument();
		await expect.element(screen.getByRole('radio', { name: 'Dark' })).toBeInTheDocument();
		await expect.element(screen.getByRole('radio', { name: 'System' })).toBeInTheDocument();
	});

	it('changes theme on click', async () => {
		const screen = render(ThemeToggle, { variant: 'segmented' });
		const darkOption = screen.getByRole('radio', { name: 'Dark' });

		await darkOption.click();
		expect(themeManager.theme).toBe('dark');
	});
});
