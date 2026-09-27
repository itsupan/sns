import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import PostCard from './PostCard.svelte';

describe('PostCard component', () => {
	it('renders author info, title, and location', async () => {
		const screen = render(PostCard);

		await expect.element(screen.getByText('Elena Rostova')).toBeInTheDocument();
		await expect
			.element(screen.getByText('Quiet Brutalism: Concrete Light & Shadows'))
			.toBeInTheDocument();
		await expect.element(screen.getByText('Fondazione Prada, Milano')).toBeInTheDocument();
	});

	it('toggles like button on click', async () => {
		const screen = render(PostCard);

		const likeButton = screen.getByRole('button', { name: 'Like post' });
		await expect.element(likeButton).toBeInTheDocument();
		await expect.element(screen.getByText('842')).toBeInTheDocument();

		await likeButton.click();
		await expect.element(screen.getByText('843')).toBeInTheDocument();
	});

	it('renders multi-image carousel counter and navigates slides', async () => {
		const screen = render(PostCard);

		await expect.element(screen.getByText('1/4')).toBeInTheDocument();

		const nextButton = screen.getByRole('button', { name: 'Next slide' });
		await expect.element(nextButton).toBeInTheDocument();

		await nextButton.click();
		await expect.element(screen.getByText('2/4')).toBeInTheDocument();
	});
});
