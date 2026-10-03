import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import ProfilePage from './+page.svelte';

const testUser = {
	id: 'user-test-1',
	name: 'Kenji Sato',
	email: 'kenji@example.com',
	handle: 'kenji.sato',
	image: null,
	title: 'Street & Monochrome Photographer',
	bio: 'Shooting 35mm film across Shinjuku and Ginza.',
	website: 'kenjisato.jp',
	location: 'Tokyo, Japan',
	cameraGear: 'Leica M6 · Summicron 35mm',
	badgeText: 'CURATOR'
};

const testStats = {
	postsCount: 5,
	followersCount: 120,
	followingCount: 85,
	impressionsCount: 1200,
	followStatus: 'none' as const
};

const newRegisteredUser = {
	id: 'user-new-2',
	name: 'Sarah Connor',
	email: 'sarah@example.com',
	handle: null,
	image: null,
	title: null,
	bio: null,
	website: null,
	location: null,
	cameraGear: null
};

const emptyStats = {
	postsCount: 0,
	followersCount: 0,
	followingCount: 0,
	impressionsCount: 0,
	followStatus: 'none' as const
};

describe('Profile Page', () => {
	it('renders authenticated user profile info, badge, and stats', async () => {
		const screen = render(ProfilePage, {
			props: {
				data: {
					imageTransforms: false,
					turnstileSiteKey: null,
					pushPublicKey: null,
					user: testUser,
					posts: [],
					nextCursor: null,
					saved: [],
					stats: testStats
				}
			}
		});

		// User identity
		await expect.element(screen.getByText('Kenji Sato').first()).toBeInTheDocument();
		await expect.element(screen.getByText('@kenji.sato').first()).toBeInTheDocument();
		await expect
			.element(screen.getByText('Street & Monochrome Photographer').first())
			.toBeInTheDocument();
		await expect
			.element(screen.getByText('Shooting 35mm film across Shinjuku and Ginza.').first())
			.toBeInTheDocument();
		await expect.element(screen.getByText('kenjisato.jp').first()).toBeInTheDocument();
		await expect.element(screen.getByText('Tokyo, Japan').first()).toBeInTheDocument();
		await expect.element(screen.getByText('Leica M6 · Summicron 35mm').first()).toBeInTheDocument();

		// Stats
		await expect.element(screen.getByText('5').first()).toBeInTheDocument();
		await expect.element(screen.getByText('120').first()).toBeInTheDocument();
		await expect.element(screen.getByText('85').first()).toBeInTheDocument();
		await expect.element(screen.getByText('1.2K').first()).toBeInTheDocument();
		await expect.element(screen.getByText('impressions').first()).toBeInTheDocument();

		// Own profile action buttons (no duplication: Edit Profile button + Settings gear)
		await expect.element(screen.getByText('Edit Profile').first()).toBeInTheDocument();
		await expect.element(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();

		// Filter pills
		await expect.element(screen.getByText('Curated Grid')).toBeInTheDocument();
		await expect.element(screen.getByText('Editorial Essays / Series')).not.toBeInTheDocument();
	});

	it('displays only the user data without dummy data for newly registered users', async () => {
		const screen = render(ProfilePage, {
			props: {
				data: {
					imageTransforms: false,
					turnstileSiteKey: null,
					pushPublicKey: null,
					user: newRegisteredUser,
					posts: [],
					nextCursor: null,
					saved: [],
					stats: emptyStats
				}
			}
		});

		// Real user name and handle derived from email
		await expect.element(screen.getByText('Sarah Connor').first()).toBeInTheDocument();
		await expect.element(screen.getByText('@sarah').first()).toBeInTheDocument();

		// Empty state instead of static dummy photos of another user
		await expect.element(screen.getByText('No posts yet')).toBeInTheDocument();
		await expect.element(screen.getByText('Create your first post')).toBeInTheDocument();

		// Add bio prompt instead of dummy brutalist bio
		await expect.element(screen.getByText('Add a bio to your profile...')).toBeInTheDocument();

		// Elena Rostova dummy data must NOT exist
		expect(document.body.textContent).not.toContain('Elena Rostova');
		expect(document.body.textContent).not.toContain('Hasselblad 500C/M');
		expect(document.body.textContent).not.toContain('elenarostova.com');
	});

	it('sets document title and metadata dynamically for the user', async () => {
		render(ProfilePage, {
			props: {
				data: {
					imageTransforms: false,
					turnstileSiteKey: null,
					pushPublicKey: null,
					user: testUser,
					posts: [],
					nextCursor: null,
					saved: [],
					stats: testStats
				}
			}
		});

		expect(document.title).toBe('Kenji Sato (@kenji.sato) — Kizuna');
		const metaDesc = document.querySelector('meta[name="description"]');
		expect(metaDesc?.getAttribute('content')).toBe('Shooting 35mm film across Shinjuku and Ginza.');
	});

	it('opens settings menu containing share, theme, and logout without duplicate edit profile', async () => {
		const screen = render(ProfilePage, {
			props: {
				data: {
					imageTransforms: false,
					turnstileSiteKey: null,
					pushPublicKey: null,
					user: testUser,
					posts: [],
					nextCursor: null,
					saved: [],
					stats: testStats
				}
			}
		});

		const settingsBtn = screen.getByRole('button', { name: 'Settings' });
		await expect.element(settingsBtn).toBeInTheDocument();
		await settingsBtn.click();

		// Appearance / Theme
		await expect.element(screen.getByText(/Theme|Appearance/i).first()).toBeInTheDocument();
		// Share profile is moved into settings dropdown
		await expect
			.element(screen.getByText(/Share Profile|Share profile/i).first())
			.toBeInTheDocument();
		// Log out
		await expect.element(screen.getByText('Log out').first()).toBeInTheDocument();
	});
});
