import { render } from 'vitest-browser-svelte';
import { cdp } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigating } from '../../../test/navigating.svelte';
import NavigationProgress from './NavigationProgress.svelte';

vi.mock('$app/state', () => import('../../../test/navigating.svelte'));

function startNavigation() {
	navigating.to = { url: new URL('http://localhost/explore') };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const reducedMotion = (value: 'reduce' | '') =>
	cdp().send('Emulation.setEmulatedMedia', {
		features: [{ name: 'prefers-reduced-motion', value }]
	});

afterEach(async () => {
	navigating.to = null;
	await reducedMotion('');
});

describe('NavigationProgress', () => {
	it('shows an animated, labelled progress bar once a navigation takes longer than 150ms', async () => {
		const screen = render(NavigationProgress);
		const bar = screen.getByRole('progressbar', { name: 'Loading page' });

		startNavigation();
		await wait(50);
		expect(bar.query()).toBeNull();

		await expect.element(bar).toBeInTheDocument();
		expect(getComputedStyle(bar.element().firstElementChild!).animationName).not.toBe('none');

		navigating.to = null;
		await expect.element(bar).not.toBeInTheDocument();
	});

	it('never shows for a navigation that finishes quickly', async () => {
		const screen = render(NavigationProgress);
		startNavigation();
		await wait(50);
		navigating.to = null;
		await wait(250);
		expect(screen.getByRole('progressbar').query()).toBeNull();
	});

	it('holds the bar still when the user prefers reduced motion', async () => {
		await reducedMotion('reduce');
		const screen = render(NavigationProgress);
		startNavigation();

		const bar = screen.getByRole('progressbar', { name: 'Loading page' });
		await expect.element(bar).toBeInTheDocument();
		expect(getComputedStyle(bar.element().firstElementChild!).animationName).toBe('none');
	});
});
