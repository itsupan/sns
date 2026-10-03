import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { beforeAll, describe, expect, it } from 'vitest';
import CreatePostBox from './CreatePostBox.svelte';
// Tailwind spreads the studio's dialog over the viewport, so a corner click lands on its backdrop.
import '../../../app.css';

// The inline composer and its studio are desktop-only.
beforeAll(() => page.viewport(1280, 900));

describe('CreatePostBox', () => {
	it('renders composer with input, post types, and publish button', async () => {
		const screen = render(CreatePostBox);

		await expect
			.element(screen.getByPlaceholder('Share an architectural observation, exhibition note...'))
			.toBeInTheDocument();
		await expect.element(screen.getByRole('radio', { name: /Photo/i })).toBeInTheDocument();
		await expect.element(screen.getByRole('radio', { name: /Story/i })).toBeInTheDocument();
		await expect.element(screen.getByRole('radio', { name: /Article/i })).toBeInTheDocument();
		await expect.element(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
	});

	it('switches to article mode and shows article title input', async () => {
		const screen = render(CreatePostBox);

		const articleRadio = screen.getByRole('radio', { name: /Article/i });
		await articleRadio.click();

		await expect.element(screen.getByPlaceholder('Article title...')).toBeInTheDocument();
	});

	it('opens the studio as a modal that Escape or the backdrop closes, keeping the draft', async () => {
		const screen = render(CreatePostBox);
		const studioMode = screen.getByRole('button', { name: 'Studio mode' });

		await studioMode.click();
		const studio = screen.getByRole('dialog', { name: 'Studio Creation Suite' });
		await expect.element(studio).toBeVisible();
		expect(studio.element().matches(':modal')).toBe(true);
		await userEvent.keyboard('{Escape}');
		await expect.element(studio).not.toBeInTheDocument();
		await expect.element(studioMode).toHaveFocus();

		await studioMode.click();
		await screen.getByLabelText('Curatorial narrative').fill('Concrete at dusk');
		await studio.click({ position: { x: 4, y: 4 } });
		await expect.element(studio).not.toBeInTheDocument();
		await expect.element(screen.getByLabelText('Post content')).toHaveValue('Concrete at dusk');
	});
});
