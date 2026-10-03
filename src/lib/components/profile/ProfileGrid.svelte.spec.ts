import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import type { PostData } from '$lib/components/feed/PostCard.svelte';
import ProfileGrid, { type GridItem } from './ProfileGrid.svelte';

const goto = vi.hoisted(() => vi.fn());
vi.mock('$app/navigation', () => ({ goto }));

const gridItem = (id: string, extra: Partial<GridItem> = {}): GridItem => {
	const post: PostData = {
		id,
		author: { id: 'u-aoi', name: 'Aoi Tanaka', handle: '@aoi', avatar: '' },
		title: '',
		description: `Post ${id}`,
		image: '',
		tags: [],
		likes: 0,
		commentsCount: 0,
		repostsCount: 0
	};
	return { id, title: `Saved ${id}`, image: '', likes: 0, comments: 0, post, ...extra };
};

describe('ProfileGrid Saved tab', () => {
	it('renders text-only and video saves without broken images, and links to all saves', async () => {
		const screen = render(ProfileGrid, {
			props: {
				activeTab: 'saved',
				savedPosts: [
					gridItem('text', { description: 'Just words', mediaType: 'none' }),
					gridItem('clip', { image: 'https://cdn.test/clip.mp4', mediaType: 'video' }),
					gridItem('photo', { image: 'https://cdn.test/photo.jpg', mediaType: 'image' })
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

describe('ProfileGrid posts', () => {
	it("names the owner in someone else's empty profile", async () => {
		const screen = render(ProfileGrid, { props: { isOwnProfile: false, userName: 'Aoi Tanaka' } });
		await expect.element(screen.getByText("Aoi Tanaka hasn't shared any posts yet.")).toBeVisible();
	});

	it('opens a post on its own page', async () => {
		const screen = render(ProfileGrid, { props: { items: [gridItem('p-1')] } });
		await screen.getByRole('button', { name: 'View post Saved p-1' }).click();
		expect(goto).toHaveBeenCalledWith('/post/p-1');
	});

	it('shows each post as a full card in list view', async () => {
		const screen = render(ProfileGrid, {
			props: { viewMode: 'feed', items: [gridItem('p-1'), gridItem('p-2')] }
		});
		await expect.element(screen.getByText('Post p-2')).toBeVisible();
		expect(screen.getByRole('article').elements()).toHaveLength(2);
	});
});
