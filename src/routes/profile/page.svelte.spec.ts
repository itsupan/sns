import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import ProfilePage from './+page.svelte';

describe('Profile Page', () => {
	it('renders profile info, master curator badge, and stats', async () => {
		const screen = render(ProfilePage);

		// Elena Rostova identity
		await expect.element(screen.getByText('Elena Rostova').first()).toBeInTheDocument();
		await expect.element(screen.getByText('MASTER CURATOR')).toBeInTheDocument();
		await expect.element(screen.getByText('elenarostova.com/archive').first()).toBeInTheDocument();

		// Stats
		await expect.element(screen.getByText('Archived Works')).toBeInTheDocument();
		await expect.element(screen.getByText('Curators Following')).toBeInTheDocument();
		await expect.element(screen.getByText('Total Impressions')).toBeInTheDocument();

		// Story highlights
		await expect.element(screen.getByText("Kyoto '23")).toBeInTheDocument();
		await expect.element(screen.getByText('Gear & EXIF')).toBeInTheDocument();

		// Filter pills
		await expect.element(screen.getByText('Curated Grid')).toBeInTheDocument();
		await expect.element(screen.getByText('Editorial Essays / Series')).toBeInTheDocument();
	});

	it('switches between grid and feed/list view modes', async () => {
		const screen = render(ProfilePage);

		// Switch to feed / list view
		const feedViewBtn = screen.getByRole('button', { name: 'Feed layout' });
		await feedViewBtn.click();

		// Feed layout renders post cards with metadata and descriptions
		await expect
			.element(
				screen.getByText(
					'Continuous cast concrete helical staircase with natural zenital light pouring through the overhead skylight. Shot on Hasselblad 500C/M.'
				)
			)
			.toBeInTheDocument();

		// Switch to compact layout
		const compactViewBtn = screen.getByRole('button', { name: 'Compact layout' });
		await compactViewBtn.click();

		await expect.element(screen.getByText('35mm · ISO 200 · f/2.0')).toBeInTheDocument();

		// Switch to Editorial Essays tab
		const essaysTab = screen.getByRole('tab', { name: 'Editorial Essays / Series' });
		await essaysTab.click();

		await expect
			.element(screen.getByText('Quiet Brutalism: Concrete Light & Shadows in Copenhagen'))
			.toBeInTheDocument();
	});
});
