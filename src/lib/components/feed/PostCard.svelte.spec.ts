import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import PostCard from './PostCard.svelte';

describe('PostCard component', () => {
	it('renders author info, title, and metadata badge', async () => {
		const screen = render(PostCard);

		await expect.element(screen.getByText('Elena Rostova')).toBeInTheDocument();
		await expect
			.element(screen.getByText('Quiet Brutalism: Concrete Light & Shadows'))
			.toBeInTheDocument();
		await expect.element(screen.getByText('35mm · ISO 200')).toBeInTheDocument();
	});

	it('toggles like button on click', async () => {
		const screen = render(PostCard);

		const likeButton = screen.getByRole('button', { name: 'Like post' });
		await expect.element(likeButton).toBeInTheDocument();
		await expect.element(screen.getByText('842')).toBeInTheDocument();

		await likeButton.click();
		await expect.element(screen.getByText('843')).toBeInTheDocument();
	});
});
