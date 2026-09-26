import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import ProfileEditPage from './+page.svelte';

describe('Profile Edit Page', () => {
	it('renders back link and profile settings form', async () => {
		const screen = render(ProfileEditPage, {
			props: {
				data: {
					user: {
						id: 'user-1',
						name: 'Elena Rostova',
						email: 'elena@example.com',
						handle: 'elena.rostova',
						title: 'Curator',
						bio: 'Bio text',
						website: 'elena.com',
						location: 'Tokyo',
						cameraGear: 'Leica',
						image: null
					}
				}
			}
		});

		await expect.element(screen.getByText('Back to Profile')).toBeInTheDocument();
		await expect.element(screen.getByText('Edit Profile')).toBeInTheDocument();
		await expect.element(screen.getByLabelText('Display Name *')).toHaveValue('Elena Rostova');
	});
});
