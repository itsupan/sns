import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import Avatar from './Avatar.svelte';

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

describe('Avatar component', () => {
	it('renders fallback initials when name is provided without src', async () => {
		const screen = render(Avatar, { name: 'Elena Vance' });
		await expect.element(screen.getByText('EV')).toBeInTheDocument();
	});

	it('renders image when src is provided', async () => {
		const screen = render(Avatar, {
			src: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
			alt: 'Elena Photo'
		});
		const img = screen.getByRole('img', { name: 'Elena Photo' });
		await expect.element(img).toBeInTheDocument();
	});

	it('gives the image its intrinsic size and loads it lazily off the main thread', async () => {
		const screen = render(Avatar, { src: PIXEL, alt: 'Ann', size: 'lg' });
		const img = screen.getByRole('img', { name: 'Ann' });
		await expect.element(img).toHaveAttribute('width', '48');
		await expect.element(img).toHaveAttribute('height', '48');
		await expect.element(img).toHaveAttribute('loading', 'lazy');
		await expect.element(img).toHaveAttribute('decoding', 'async');
	});

	it('loads eagerly when above the fold, at a pixel size', async () => {
		const screen = render(Avatar, {
			src: PIXEL,
			alt: 'Ann',
			size: 30,
			loading: 'eager'
		});
		const img = screen.getByRole('img', { name: 'Ann' });
		await expect.element(img).toHaveAttribute('width', '30');
		await expect.element(img).toHaveAttribute('loading', 'eager');
	});

	it('renders ring class when ring prop is enabled', async () => {
		const screen = render(Avatar, {
			name: 'Aalto',
			ring: 'blue',
			'data-testid': 'avatar-container'
		});
		const container = screen.getByTestId('avatar-container');
		await expect.element(container).toBeInTheDocument();
	});
});
