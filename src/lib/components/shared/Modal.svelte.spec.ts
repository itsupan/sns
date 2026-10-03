import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import ModalHarness from '../../../test/ModalHarness.svelte';
// The scroll lock is a rule in the global stylesheet.
import '../../../app.css';

const pageOverflow = () => getComputedStyle(document.documentElement).overflow;

async function openOuter(props: { closeOnBackdrop?: boolean } = {}) {
	const onclose = vi.fn();
	const screen = render(ModalHarness, { props: { ...props, onclose } });
	const opener = screen.getByRole('button', { name: 'Open', exact: true });
	await opener.click();
	const outer = screen.getByRole('dialog', { name: 'Outer' });
	await expect.element(outer).toBeVisible();
	return { screen, opener, outer, onclose };
}

describe('Modal', () => {
	it('opens as a modal dialog on its autofocus control, and hands focus back to the opener on Escape', async () => {
		const { screen, opener, outer, onclose } = await openOuter();
		expect(outer.element().matches(':modal')).toBe(true);
		await expect.element(screen.getByRole('button', { name: 'Open nested' })).toHaveFocus();

		await userEvent.keyboard('{Escape}');
		await expect.element(outer).not.toBeInTheDocument();
		await expect.element(opener).toHaveFocus();
		expect(onclose).toHaveBeenCalledOnce();
	});

	it('keeps focus out of the page behind it', async () => {
		const { screen, opener, outer } = await openOuter();
		await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
		await expect.element(screen.getByRole('button', { name: 'First' })).toHaveFocus();

		// The page is inert: not even a script can focus it.
		(opener.element() as HTMLElement).focus();
		expect(outer.element().contains(document.activeElement)).toBe(true);
	});

	it('closes on a backdrop click but not on a click inside', async () => {
		const { screen, outer, onclose } = await openOuter();

		await screen.getByText('Outer content').click();
		expect(onclose).not.toHaveBeenCalled();
		await expect.element(outer).toBeVisible();

		await outer.click({ position: { x: 4, y: 4 } });
		await expect.element(outer).not.toBeInTheDocument();
		expect(onclose).toHaveBeenCalledOnce();
	});

	it('stays open when a press starts inside and is released over the backdrop', async () => {
		const { screen, outer, onclose } = await openOuter();
		const content = screen.getByText('Outer content').element();

		content.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		outer.element().dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(onclose).not.toHaveBeenCalled();
		await expect.element(outer).toBeVisible();
	});

	it('can ignore backdrop clicks', async () => {
		const { outer, onclose } = await openOuter({ closeOnBackdrop: false });

		await outer.click({ position: { x: 4, y: 4 } });
		expect(onclose).not.toHaveBeenCalled();
		await expect.element(outer).toBeVisible();
	});

	it('locks page scroll while open', async () => {
		expect(pageOverflow()).toBe('visible');
		await openOuter();
		expect(pageOverflow()).toBe('hidden');

		await userEvent.keyboard('{Escape}');
		await vi.waitFor(() => expect(pageOverflow()).toBe('visible'));
	});

	it('closes only the top modal on Escape when one is open inside another', async () => {
		const { screen, opener, outer } = await openOuter();
		const openNested = screen.getByRole('button', { name: 'Open nested' });
		await openNested.click();
		const inner = screen.getByRole('dialog', { name: 'Inner' });
		await expect.element(inner).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Inner action' })).toHaveFocus();

		await userEvent.keyboard('{Escape}');
		await expect.element(inner).not.toBeInTheDocument();
		await expect.element(outer).toBeVisible();
		await expect.element(openNested).toHaveFocus();
		expect(pageOverflow()).toBe('hidden');

		await userEvent.keyboard('{Escape}');
		await expect.element(outer).not.toBeInTheDocument();
		await expect.element(opener).toHaveFocus();
		expect(pageOverflow()).toBe('visible');
	});
});
