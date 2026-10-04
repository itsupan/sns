import { render } from 'vitest-browser-svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';
import type { ExploreTile, SuggestedCreator } from '$lib/explore/types';

const tile = (id: string): ExploreTile => ({
	id,
	title: `Post ${id}`,
	cover: null,
	isCarousel: false,
	likes: 1,
	comments: 0
});

const creator: SuggestedCreator = {
	id: 'dan',
	name: 'Dan',
	handle: '@dan',
	slug: 'dan',
	image: null,
	followersCount: 12,
	mutuals: 2
};

let calls: Array<{ url: string; method: string }>;

beforeEach(() => {
	calls = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, init?: RequestInit) => {
			calls.push({ url, method: init?.method ?? 'GET' });
			if (url.startsWith('/api/explore'))
				return Response.json({ tiles: [tile('t3')], hasMore: false });
			return Response.json({ following: true, followersCount: 13 });
		})
	);
});

afterEach(() => vi.unstubAllGlobals());

function renderPage(overrides: Record<string, unknown> = {}) {
	return render(Page, {
		props: {
			data: {
				signedIn: true,
				tiles: [tile('t1'), tile('t2')],
				hasMore: false,
				trending: [{ slug: 'film', name: 'Film', posts: 4 }],
				suggestions: [creator],
				...overrides
			}
		} as never
	});
}

describe('/explore', () => {
	it('shows trending tags, creators and post tiles linking to their pages', async () => {
		const screen = await renderPage();
		await expect
			.element(screen.getByRole('link', { name: /#Film/ }))
			.toHaveAttribute('href', '/explore/tags/film');
		await expect.element(screen.getByText('Followed by 2 you follow')).toBeVisible();
		await expect
			.element(screen.getByRole('link', { name: 'Post t1' }))
			.toHaveAttribute('href', '/post/t1');
	});

	it('follows a suggested creator', async () => {
		const screen = await renderPage();
		await screen.getByRole('button', { name: 'Follow Dan' }).click();
		await expect.element(screen.getByRole('button', { name: 'Unfollow Dan' })).toBeVisible();
		expect(calls).toContainEqual({ url: '/api/users/dan/follow', method: 'POST' });
	});

	it('loads the next page when scrolled to the end', async () => {
		const screen = await renderPage({ hasMore: true });
		await expect.element(screen.getByRole('link', { name: 'Post t3' })).toBeVisible();
		expect(calls[0].url).toBe('/api/explore?page=1');
		expect(screen.getByTestId('tile').elements()).toHaveLength(3);
	});

	it('explains an empty Explore', async () => {
		const screen = await renderPage({ tiles: [], trending: [], suggestions: [] });
		await expect.element(screen.getByText('Nothing new to explore yet')).toBeVisible();
	});
});
