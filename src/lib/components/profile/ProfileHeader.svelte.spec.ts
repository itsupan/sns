import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import ProfileHeader from './ProfileHeader.svelte';

describe('ProfileHeader', () => {
	it('renders owner actions when viewing current user profile', async () => {
		const screen = render(ProfileHeader, {
			props: {
				profile: {
					name: 'Current User',
					handle: 'current.user',
					isOwnProfile: true
				}
			}
		});

		// Header displays user info
		await expect.element(screen.getByText('Current User').first()).toBeInTheDocument();
		await expect.element(screen.getByText('@current.user').first()).toBeInTheDocument();

		// Displays Edit Profile button and Settings button
		await expect.element(screen.getByText('Edit Profile').first()).toBeInTheDocument();
		await expect.element(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();

		// Should NOT display visitor action buttons
		await expect.element(screen.getByRole('button', { name: /Follow/i })).not.toBeInTheDocument();
		await expect.element(screen.getByRole('button', { name: /Message/i })).not.toBeInTheDocument();

		// Open Settings menu
		const settingsBtn = screen.getByRole('button', { name: 'Settings' });
		await settingsBtn.click();

		// In settings: Share Profile, Theme, and Log out are available
		await expect.element(screen.getByText(/Share/i).first()).toBeInTheDocument();
		await expect.element(screen.getByText(/Theme|Appearance/i).first()).toBeInTheDocument();
		await expect.element(screen.getByText('Log out').first()).toBeInTheDocument();
	});

	it("renders visitor actions and hides owner actions when viewing another user's profile", async () => {
		const screen = render(ProfileHeader, {
			props: {
				profile: {
					name: 'Elena Rostova',
					handle: 'elena.rostova',
					isOwnProfile: false
				}
			}
		});

		// Displays visitor buttons
		await expect.element(screen.getByText(/Follow/i).first()).toBeInTheDocument();
		await expect.element(screen.getByText(/Message/i).first()).toBeInTheDocument();
		await expect.element(screen.getByRole('button', { name: 'Share profile' })).toBeInTheDocument();

		// MUST NOT display owner actions
		await expect.element(screen.getByText('Edit Profile')).not.toBeInTheDocument();
		await expect.element(screen.getByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
	});

	it('redirects unauthenticated visitor when clicking Follow or Message', async () => {
		const screen = render(ProfileHeader, {
			props: {
				profile: {
					name: 'Elena Rostova',
					handle: 'elena.rostova',
					isOwnProfile: false
				}
			}
		});

		const followBtn = screen.getByRole('button', { name: /Follow/i });
		await followBtn.click();
		await expect.element(followBtn).toBeInTheDocument();

		const messageBtn = screen.getByRole('button', { name: /Message/i });
		await messageBtn.click();
		await expect.element(messageBtn).toBeInTheDocument();
	});

	it('opens ShareProfileModal when clicking Share profile button', async () => {
		const screen = render(ProfileHeader, {
			props: {
				profile: {
					name: 'Elena Rostova',
					handle: 'elena.rostova',
					isOwnProfile: false
				}
			}
		});

		const shareBtn = screen.getByRole('button', { name: 'Share profile' });
		await shareBtn.click();

		await expect.element(screen.getByText('Share Profile')).toBeInTheDocument();
		await expect.element(screen.getByText('Telegram')).toBeInTheDocument();
		await expect.element(screen.getByText('Facebook')).toBeInTheDocument();
	});
});
