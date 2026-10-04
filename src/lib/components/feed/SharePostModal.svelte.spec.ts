import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import SharePostModal from './SharePostModal.svelte';
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
	commentsCount: 3,
	repostsCount: 1
};

describe('SharePostModal', () => {
	it('renders share post dialog with social platforms and copy link', async () => {
		const screen = await render(SharePostModal, {
			props: {
				open: true,
				post: testPost
			}
		});

		await expect.element(screen.getByText('Share Post')).toBeInTheDocument();
		await expect.element(screen.getByText('Elena Rostova').first()).toBeInTheDocument();

		const telegramLink = screen.getByRole('link', { name: /Telegram/i });
		const facebookLink = screen.getByRole('link', { name: /Facebook/i });
		const whatsappLink = screen.getByRole('link', { name: /WhatsApp/i });
		const xLink = screen.getByRole('link', { name: /X/i });

		await expect.element(telegramLink).toBeInTheDocument();
		await expect.element(facebookLink).toBeInTheDocument();
		await expect.element(whatsappLink).toBeInTheDocument();
		await expect.element(xLink).toBeInTheDocument();

		await expect
			.element(telegramLink)
			.toHaveAttribute('href', expect.stringContaining('t.me/share/url'));
		await expect
			.element(facebookLink)
			.toHaveAttribute('href', expect.stringContaining('facebook.com/sharer'));

		const copyBtn = screen.getByRole('button', { name: /Copy/i });
		await expect.element(copyBtn).toBeInTheDocument();
	});
});
