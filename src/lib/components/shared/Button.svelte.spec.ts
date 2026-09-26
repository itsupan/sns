import { createRawSnippet } from 'svelte';
import { resolve } from '$app/paths';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import Button from './Button.svelte';

describe('Button component', () => {
	it('renders with default primary styling', async () => {
		const screen = render(Button, {
			children: createRawSnippet(() => ({
				render: () => '<span>Click Me</span>'
			}))
		});

		const btn = screen.getByRole('button');
		await expect.element(btn).toBeInTheDocument();
		await expect.element(btn).toHaveTextContent('Click Me');
		await expect.element(btn).toHaveClass('btn-primary');
	});

	it('renders as anchor when href is provided', async () => {
		const screen = render(Button, {
			href: resolve('/login'),
			children: createRawSnippet(() => ({
				render: () => '<span>Go to Login</span>'
			}))
		});

		const link = screen.getByRole('link');
		await expect.element(link).toBeInTheDocument();
		await expect.element(link).toHaveAttribute('href', '/login');
	});

	it('renders disabled state', async () => {
		const screen = render(Button, {
			disabled: true,
			children: createRawSnippet(() => ({
				render: () => '<span>Disabled</span>'
			}))
		});

		const btn = screen.getByRole('button');
		await expect.element(btn).toBeDisabled();
	});
});
