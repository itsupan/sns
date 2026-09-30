import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import ProfileGrid, { type GridItem } from './ProfileGrid.svelte';

const saved = (id: string, extra: Partial<GridItem>): GridItem => ({
	id,
	title: `Saved ${id}`,
	image: '',
	likes: 0,
	comments: 0,
	...extra
});

describe('ProfileGrid Saved tab', () => {
	it('renders text-only and video saves without broken images, and links to all saves', async () => {
		const screen = render(ProfileGrid, {
			props: {
				activeTab: 'saved',
				savedPosts: [
					saved('text', { description: 'Just words', mediaType: 'none' }),
					saved('clip', { image: 'https://cdn.test/clip.mp4', mediaType: 'video' }),
					saved('photo', { image: 'https://cdn.test/photo.jpg', mediaType: 'image' })
				]
			}
		});
		await expect.element(screen.getByRole('link', { name: 'See all saved posts' })).toBeVisible();
		const tiles = screen.container.querySelectorAll('[aria-label^="View saved post"]');
		expect(tiles).toHaveLength(3);
		expect(tiles[0].querySelector('img')).toBeNull();
		expect(tiles[1].querySelector('img')).toBeNull();
		expect(tiles[1].querySelector('video')).not.toBeNull();
		expect(tiles[2].querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/photo.jpg');
	});

	it('shows the empty state when nothing is saved', async () => {
		const screen = render(ProfileGrid, { props: { activeTab: 'saved', savedPosts: [] } });
		await expect.element(screen.getByText('No saved posts')).toBeVisible();
	});
});
