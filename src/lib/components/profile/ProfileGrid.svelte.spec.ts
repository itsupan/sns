import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PostData } from '$lib/components/feed/PostCard.svelte';
import ProfileGrid, { type GridItem } from './ProfileGrid.svelte';
import { stubIntersectionObserver } from '../../../test/intersection-observer';

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
		sharesCount: 0
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

describe('ProfileGrid paging', () => {
	const tile = (id: string) => gridItem(id, { title: id });
	let urls: string[];

	function stubPosts(respond: () => Response) {
		urls = [];
		stubIntersectionObserver();
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) => {
				urls.push(url);
				return respond();
			})
		);
	}

	afterEach(() => vi.unstubAllGlobals());

	it('loads the next page of the profile when scrolled to the end, skipping repeats', async () => {
		stubPosts(() => Response.json({ posts: [tile('first'), tile('second')], nextCursor: null }));
		const screen = render(ProfileGrid, {
			props: { items: [tile('first')], userId: 'u 1', nextCursor: '1700_first' }
		});

		await expect.element(screen.getByRole('button', { name: 'View post second' })).toBeVisible();
		expect(urls).toEqual(['/api/users/u%201/posts?cursor=1700_first']);
		expect(screen.getByRole('button', { name: /^View post/ }).elements()).toHaveLength(2);
	});

	it('shows a failed page with a retry', async () => {
		let fail = true;
		stubPosts(() =>
			fail
				? Response.json({ error: { code: 'internal', message: 'Server hiccup' } }, { status: 500 })
				: Response.json({ posts: [tile('second')], nextCursor: null })
		);
		const screen = render(ProfileGrid, {
			props: { items: [tile('first')], userId: 'u1', nextCursor: '1700_first' }
		});
		await expect.element(screen.getByRole('alert')).toHaveTextContent('Server hiccup');

		fail = false;
		await screen.getByRole('button', { name: 'Try again' }).click();
		await expect.element(screen.getByRole('button', { name: 'View post second' })).toBeVisible();
	});

	it('drops the pages it loaded when it switches to another profile', async () => {
		stubPosts(() => Response.json({ posts: [tile('second')], nextCursor: null }));
		const screen = render(ProfileGrid, {
			props: { items: [tile('first')], userId: 'u1', nextCursor: '1700_first' }
		});
		await expect.element(screen.getByRole('button', { name: 'View post second' })).toBeVisible();

		await screen.rerender({ items: [tile('other')], userId: 'u2', nextCursor: null });
		await expect.element(screen.getByRole('button', { name: 'View post other' })).toBeVisible();
		expect(screen.getByRole('button', { name: /^View post/ }).elements()).toHaveLength(1);
	});
});
