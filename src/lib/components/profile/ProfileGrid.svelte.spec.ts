import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
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
		const screen = await render(ProfileGrid, {
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
		const screen = await render(ProfileGrid, { props: { activeTab: 'saved', savedPosts: [] } });
		await expect.element(screen.getByText('No saved posts')).toBeVisible();
	});

	it('shows demo items read-only in list view, with no buttons that do nothing', async () => {
		const screen = await render(ProfileGrid, { props: { viewMode: 'feed' } });

		await expect.element(screen.getByText('Brutalist Spiral Staircase Atrium')).toBeInTheDocument();
		expect(document.querySelector('[aria-label="Post options"]')).toBeNull();
		expect(document.querySelector('[aria-label="Save work"]')).toBeNull();
	});

	it('opens a demo item in a modal dialog that closes on Escape and returns focus', async () => {
		const screen = await render(ProfileGrid, {
			props: { items: [{ id: 'g9', title: 'Bare study', image: '', likes: 1, comments: 0 }] }
		});
		const tile = screen.getByRole('button', { name: 'View post Bare study' });
		await tile.click();

		const dialog = screen.getByRole('dialog', { name: 'Bare study' });
		await expect.element(dialog).toBeVisible();
		expect(dialog.element().matches(':modal')).toBe(true);
		expect(document.body.style.overflow).toBe('hidden');
		expect(document.body.textContent).not.toContain('Hasselblad');

		await userEvent.keyboard('{Escape}');
		await expect.element(dialog).not.toBeInTheDocument();
		expect(document.body.style.overflow).toBe('');
		expect(document.activeElement).toBe(tile.element());
	});
});
