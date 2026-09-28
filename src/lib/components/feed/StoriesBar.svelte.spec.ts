import { render } from 'vitest-browser-svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readable } from 'svelte/store';
import StoriesBar from './StoriesBar.svelte';
import type { StoryGroup } from '$lib/components/stories/stories.svelte';

vi.mock('$lib/auth-client', () => ({
	authClient: {
		useSession: () =>
			readable({ data: { user: { id: 'me', name: 'Me', image: null } }, isPending: false })
	}
}));

const now = Date.now();
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

const groups: StoryGroup[] = [
	{
		user: { id: 'aoi', name: 'Aoi Tanaka', handle: 'aoi', image: null },
		isSelf: false,
		stories: [
			{
				id: `aoi:${now}`,
				userId: 'aoi',
				mediaUrl: PIXEL,
				mediaType: 'image',
				caption: 'Night walk',
				location: null,
				createdAt: now,
				expiresAt: now + 3_600_000
			}
		]
	}
];

beforeEach(() => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => Response.json({ groups }))
	);
});

afterEach(() => vi.unstubAllGlobals());

describe('StoriesBar', () => {
	it('loads followed users’ stories from the API instead of mock data', async () => {
		const screen = render(StoriesBar);
		await expect
			.element(screen.getByRole('button', { name: 'View story from Aoi Tanaka, new' }))
			.toBeVisible();
		expect(fetch).toHaveBeenCalledWith('/api/stories');
		expect(document.body.textContent).not.toContain('elena.r');
		await expect.element(screen.getByRole('button', { name: 'Add your story' })).toBeVisible();
	});

	it('opens the viewer and marks the story as watched', async () => {
		const screen = render(StoriesBar);
		await screen.getByRole('button', { name: 'View story from Aoi Tanaka, new' }).click();
		await expect
			.element(screen.getByRole('dialog', { name: 'Stories from Aoi Tanaka' }))
			.toBeVisible();
		await expect.element(screen.getByText('Night walk')).toBeVisible();

		// Watching records a view on the server (so rings match on other devices).
		expect(fetch).toHaveBeenCalledWith(`/api/stories/${encodeURIComponent(`aoi:${now}`)}/view`, {
			method: 'POST'
		});

		await screen.getByRole('button', { name: 'Close stories' }).click();
		// Grey ring now: no ", new" in the label.
		await expect
			.element(screen.getByRole('button', { name: 'View story from Aoi Tanaka', exact: true }))
			.toBeVisible();
	});

	it('opens the story composer from "Your story"', async () => {
		const screen = render(StoriesBar);
		await screen.getByRole('button', { name: 'Add your story' }).click();
		await expect.element(screen.getByRole('dialog', { name: 'New story' })).toBeVisible();
		// Nothing to share until media is uploaded.
		await expect.element(screen.getByRole('button', { name: /Share to story/ })).toBeDisabled();
	});
});
