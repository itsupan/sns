import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readable } from 'svelte/store';
import RightSidebar from './RightSidebar.svelte';

vi.mock('$lib/auth-client', () => ({
	authClient: {
		useSession: () => readable({ data: { user: { id: 'me', name: 'Me' } }, isPending: false })
	}
}));

const suggestions = [
	{
		id: 'u-9',
		name: 'Sophia Vane',
		handle: '@vane.studio',
		slug: 'vane.studio',
		image: null,
		followersCount: 3,
		mutuals: 0
	}
];

afterEach(() => vi.unstubAllGlobals());

describe('RightSidebar', () => {
	it('follows a real suggested creator through the API and links to their profile', async () => {
		const fetchMock = vi.fn(async () => Response.json({ status: 'following', followersCount: 4 }));
		vi.stubGlobal('fetch', fetchMock);
		const screen = render(RightSidebar, { props: { suggestions } });

		await expect
			.element(screen.getByRole('link', { name: /Sophia Vane/ }))
			.toHaveAttribute('href', '/profile/vane.studio');
		await screen.getByRole('button', { name: 'Follow Sophia Vane' }).click();

		expect(fetchMock).toHaveBeenCalledWith('/api/users/u-9/follow', { method: 'POST' });
		await expect
			.element(screen.getByRole('button', { name: 'Unfollow Sophia Vane' }))
			.toHaveTextContent('Following');
	});

	it('hides the card when there is nobody to suggest', async () => {
		const screen = render(RightSidebar);

		await expect.element(screen.getByText('Curated Topics')).toBeInTheDocument();
		expect(document.body.textContent).not.toContain('Curators to Follow');
	});
});
