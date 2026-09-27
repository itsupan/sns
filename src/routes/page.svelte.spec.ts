import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

describe('home page', () => {
	it('shows the app name and feed layout components', async () => {
		const screen = render(Page);

		await expect
			.element(screen.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Kizuna home feed');
		await expect
			.element(screen.getByText('Quiet Brutalism: Concrete Light & Shadows'))
			.toBeInTheDocument();
		await expect.element(screen.getByText('Your story')).toBeInTheDocument();
		await expect.element(screen.getByText('Curators to Follow')).toBeInTheDocument();
	});

	it('shows "You\'re all caught up" indicator when no more posts exist', async () => {
		const screen = render(Page, {
			props: {
				data: {
					posts: [
						{
							id: 'post-test-1',
							author: {
								name: 'Elena Rostova',
								handle: '@elena.rostova',
								avatar: 'https://example.com/avatar.jpg'
							},
							title: 'Single Post',
							description: 'Test post description',
							image: 'https://example.com/test.jpg',
							tags: ['#test'],
							likes: 5,
							commentsCount: 1,
							repostsCount: 0
						}
					],
					hasMore: false,
					pageSize: 10
				}
			}
		});

		await expect.element(screen.getByText("You're all caught up")).toBeInTheDocument();
		await expect
			.element(screen.getByText("You've seen all recent posts from your feed."))
			.toBeInTheDocument();
	});
});
