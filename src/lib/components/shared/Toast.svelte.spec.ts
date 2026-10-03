import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Toast from './Toast.svelte';
import ModalHarness from '../../../test/ModalHarness.svelte';
import { toast } from '$lib/utils/toast.svelte';

afterEach(() => toast.dismiss());

describe('Toast', () => {
	it('is an open live region before the first message', async () => {
		const screen = render(Toast);
		const region = screen.getByRole('status');
		await expect.element(region).toHaveAttribute('aria-live', 'polite');
		expect(region.element().matches(':popover-open')).toBe(true);
	});

	it('enters the top layer again for each toast, above a modal opened since', async () => {
		const screen = render(Toast);
		const region = screen.getByRole('status').element();
		const page = render(ModalHarness);
		await page.getByRole('button', { name: 'Open', exact: true }).click();
		await expect.element(page.getByRole('dialog', { name: 'Outer' })).toBeVisible();

		const reopened = vi.fn();
		region.addEventListener('beforetoggle', (event) => {
			if ((event as ToggleEvent).newState === 'open') reopened();
		});
		toast.show('Link copied');
		await expect.element(screen.getByText('Link copied')).toBeVisible();
		expect(reopened).toHaveBeenCalledOnce();
		expect(region.matches(':popover-open')).toBe(true);
	});
});
