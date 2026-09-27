import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import PostCommentsModal from './PostCommentsModal.svelte';
import type { PostData } from './PostCard.svelte';

const testPost: PostData = {
	id: 'post-test-123',
	author: {
		name: 'Elena Rostova',
		handle: '@elena.rostova',
		avatar: 'https://example.com/avatar.jpg'
	},
	title: 'Quiet Brutalism',
	description: 'A study on light and shadow.',
	image: 'https://example.com/photo.jpg',
	tags: ['#Architecture'],
	likes: 12,
	commentsCount: 1,
	repostsCount: 1,
	commentPreview: {
		author: 'marcus_k',
		content: 'Immaculate textures!'
	}
};

describe('PostCommentsModal', () => {
	it('renders comments dialog and comment input', async () => {
		const screen = render(PostCommentsModal, {
			props: {
				open: true,
				post: testPost
			}
		});

		await expect.element(screen.getByText(/Comments \(1\)/)).toBeInTheDocument();
		await expect.element(screen.getByPlaceholder('Add a comment...')).toBeInTheDocument();
		await expect.element(screen.getByRole('button', { name: 'Post' })).toBeInTheDocument();
	});

	it('identifies the post author with an Author badge when the author comments', async () => {
		const authorPost: PostData = {
			...testPost,
			commentPreview: {
				author: 'Elena Rostova',
				content: 'Thank you everyone for the feedback!'
			}
		};

		const screen = render(PostCommentsModal, {
			props: {
				open: true,
				post: authorPost
			}
		});

		await expect.element(screen.getByText('Author')).toBeInTheDocument();
	});

	it('activates reply mode when Reply button is clicked', async () => {
		const screen = render(PostCommentsModal, {
			props: {
				open: true,
				post: testPost
			}
		});

		const replyBtn = screen.getByRole('button', { name: 'Reply' });
		await replyBtn.click();

		await expect.element(screen.getByText(/Replying to/)).toBeInTheDocument();
		const input = screen.getByPlaceholder('Reply to @marcus_k...');
		await expect.element(input).toBeInTheDocument();
	});
});
