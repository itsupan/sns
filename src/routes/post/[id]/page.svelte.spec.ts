import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';
import type { PostData } from '$lib/components/feed/PostCard.svelte';

const mockPost: PostData = {
	id: 'post-test-42',
	author: {
		name: 'Elena Rostova',
		handle: '@elena.rostova',
		avatar: 'https://example.com/avatar.jpg',
		location: 'Copenhagen, Denmark',
		timeAgo: '2h ago'
	},
	title: 'Minimalist Architecture Study',
	description: 'Cast light and shadows across raw concrete.',
	image: 'https://example.com/concrete.jpg',
	tags: ['#Architecture'],
	likes: 42,
	commentsCount: 5,
	sharesCount: 2
};

describe('Post Page Component', () => {
	it('renders post title, author, and back button', async () => {
		const screen = render(Page, {
			props: {
				data: {
					imageTransforms: false,
					turnstileSiteKey: null,
					post: mockPost,
					postUrl: 'https://sns.ecoapsara.com/post/post-test-42',
					origin: 'https://sns.ecoapsara.com',
					suggestions: []
				}
			}
		});

		await expect.element(screen.getByText('Back to feed')).toBeInTheDocument();
		await expect
			.element(screen.getByRole('heading', { name: 'Minimalist Architecture Study', exact: true }))
			.toBeInTheDocument();
		await expect.element(screen.getByText('Elena Rostova').first()).toBeInTheDocument();
	});
});
