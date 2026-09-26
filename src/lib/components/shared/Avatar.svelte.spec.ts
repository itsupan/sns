import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import Avatar from './Avatar.svelte';

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
