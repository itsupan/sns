import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import Icon from './Icon.svelte';

describe('Icon Component', () => {
	it('renders with default regular rounded class', async () => {
		const screen = render(Icon, { name: 'user', 'data-testid': 'user-icon' });
		const el = screen.getByTestId('user-icon');
		await expect.element(el).toBeInTheDocument();
		await expect.element(el).toHaveClass('fi');
		await expect.element(el).toHaveClass('fi-rr-user');
	});

	it('supports custom size and regular straight type', async () => {
		const screen = render(Icon, {
			name: 'camera',
			type: 'rs',
			size: 'lg',
			'data-testid': 'camera-icon'
		});
		const el = screen.getByTestId('camera-icon');
		await expect.element(el).toHaveClass('fi-rs-camera');
		await expect.element(el).toHaveClass('text-lg');
	});
});
