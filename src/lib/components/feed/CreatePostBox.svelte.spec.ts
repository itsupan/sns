import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import CreatePostBox from './CreatePostBox.svelte';

describe('CreatePostBox', () => {
	it('renders composer with input, post types, and publish button', async () => {
		const screen = await render(CreatePostBox);

		await expect
			.element(screen.getByPlaceholder('Share an architectural observation, exhibition note...'))
			.toBeInTheDocument();
		await expect.element(screen.getByRole('radio', { name: /Photo/i })).toBeInTheDocument();
		await expect.element(screen.getByRole('radio', { name: /Story/i })).toBeInTheDocument();
		await expect.element(screen.getByRole('radio', { name: /Article/i })).toBeInTheDocument();
		await expect.element(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
	});

	it('switches to article mode and shows article title input', async () => {
		const screen = await render(CreatePostBox);

		const articleRadio = screen.getByRole('radio', { name: /Article/i });
		await articleRadio.click();

		await expect.element(screen.getByPlaceholder('Article title...')).toBeInTheDocument();
	});
});
