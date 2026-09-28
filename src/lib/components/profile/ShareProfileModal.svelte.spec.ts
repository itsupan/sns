import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import ShareProfileModal from './ShareProfileModal.svelte';

const testProfile = {
	id: 'usr_test_123',
	name: 'Kenji Sato',
	handle: 'kenji.sato',
	avatar: 'https://example.com/kenji.jpg',
	bio: 'Street photographer in Tokyo',
	title: 'Curator',
	website: 'kenjisato.jp',
	location: 'Tokyo',
	cameraGear: 'Leica M6',
	badgeText: '',
	isVerified: false,
	postsCount: 10,
	followersCount: 150,
	followingCount: 50,
	impressionsCount: 1200,
	isFollowing: false,
	isOwnProfile: true
};

describe('ShareProfileModal', () => {
	it('renders share dialog with platform links and copy link', async () => {
		const screen = render(ShareProfileModal, {
			props: {
				open: true,
				profile: testProfile
			}
		});

		// Header and Profile preview
		await expect.element(screen.getByText('Share Profile')).toBeInTheDocument();
		await expect.element(screen.getByText('Kenji Sato').first()).toBeInTheDocument();
		await expect.element(screen.getByText('@kenji.sato').first()).toBeInTheDocument();

		// Platforms: Telegram, Facebook, WhatsApp, X
		const telegramLink = screen.getByRole('link', { name: /Telegram/i });
		const facebookLink = screen.getByRole('link', { name: /Facebook/i });
		const whatsappLink = screen.getByRole('link', { name: /WhatsApp/i });
		const xLink = screen.getByRole('link', { name: /X/i });

		await expect.element(telegramLink).toBeInTheDocument();
		await expect.element(facebookLink).toBeInTheDocument();
		await expect.element(whatsappLink).toBeInTheDocument();
		await expect.element(xLink).toBeInTheDocument();

		// Check platform links contain the profile URL with handle
		await expect
			.element(telegramLink)
			.toHaveAttribute('href', expect.stringContaining('t.me/share/url'));
		await expect
			.element(telegramLink)
			.toHaveAttribute('href', expect.stringContaining('profile%2Fkenji.sato'));

		await expect
			.element(facebookLink)
			.toHaveAttribute('href', expect.stringContaining('facebook.com/sharer'));
		await expect
			.element(facebookLink)
			.toHaveAttribute('href', expect.stringContaining('profile%2Fkenji.sato'));

		// Copy link button
		const copyBtn = screen.getByRole('button', { name: /Copy/i });
		await expect.element(copyBtn).toBeInTheDocument();
	});
});
