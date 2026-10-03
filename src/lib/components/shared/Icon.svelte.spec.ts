import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import Icon from './Icon.svelte';

describe('Icon Component', () => {
	it('draws the named glyph as a decorative 1em outline svg', async () => {
		const screen = render(Icon, { name: 'user', 'data-testid': 'user-icon' });
		const el = screen.getByTestId('user-icon');
		await expect.element(el).toHaveClass('lucide-user');
		await expect.element(el).toHaveClass('text-base');
		await expect.element(el).toHaveAttribute('aria-hidden', 'true');
		await expect.element(el).toHaveAttribute('width', '1em');
		await expect.element(el).toHaveAttribute('fill', 'none');
	});

	it('fills the solid type and applies the size preset', async () => {
		const screen = render(Icon, {
			name: 'heart',
			type: 'sr',
			size: 'lg',
			'data-testid': 'heart-icon'
		});
		const el = screen.getByTestId('heart-icon');
		await expect.element(el).toHaveAttribute('fill', 'currentColor');
		await expect.element(el).toHaveClass('text-lg');
	});

	it('draws a solid glyph that a fill would blot out with a bolder stroke instead', async () => {
		const screen = render(Icon, { name: 'compass-alt', type: 'sr', 'data-testid': 'compass' });
		const el = screen.getByTestId('compass');
		await expect.element(el).toHaveAttribute('fill', 'none');
		await expect.element(el).toHaveAttribute('stroke-width', '2.75');
	});

	it('sizes in pixels through the font size', async () => {
		const screen = render(Icon, { name: 'circle', size: 10, 'data-testid': 'dot' });
		const el = screen.getByTestId('dot');
		expect(getComputedStyle(el.element()).width).toBe('10px');
	});
});
