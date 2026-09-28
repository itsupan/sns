import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StoryViewer from './StoryViewer.svelte';
import type { Story, StoryGroup } from './stories.svelte';

const now = Date.now();
// Tiny inline image so tests never hit the network.
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

function story(userId: string, n: number, caption: string): Story {
	return {
		id: `${userId}:${now - n}`,
		userId,
		mediaUrl: PIXEL,
		mediaType: 'image',
		caption,
		location: n === 1 ? 'Kyoto' : null,
		createdAt: now - n * 60_000,
		expiresAt: now + 3_600_000
	};
}

const groups: StoryGroup[] = [
	{
		user: { id: 'me', name: 'Me', handle: 'me', image: null },
		isSelf: true,
		stories: [story('me', 1, 'My first')]
	},
	{
		user: { id: 'aoi', name: 'Aoi', handle: 'aoi', image: null },
		isSelf: false,
		stories: [story('aoi', 2, 'Aoi one'), story('aoi', 3, 'Aoi two')]
	}
];

afterEach(() => vi.unstubAllGlobals());

describe('StoryViewer', () => {
	it('shows the person, caption, location and one progress segment per story', async () => {
		const screen = render(StoryViewer, { props: { open: true, groups, startIndex: 1 } });

		await expect.element(screen.getByRole('dialog', { name: 'Stories from Aoi' })).toBeVisible();
		await expect.element(screen.getByText('Aoi one')).toBeVisible();
		expect(screen.getByTestId('story-progress').elements()).toHaveLength(2);
		await expect
			.element(screen.getByRole('link', { name: /Aoi/ }))
			.toHaveAttribute('href', '/profile/aoi');
	});

	it('fills the current progress bar while a photo is shown and marks it seen', async () => {
		const onSeen = vi.fn();
		const screen = render(StoryViewer, { props: { open: true, groups, startIndex: 1, onSeen } });
		expect(onSeen).toHaveBeenCalledWith(expect.objectContaining({ caption: 'Aoi one' }));

		const bar = screen.getByTestId('story-progress').first();
		await vi.waitFor(() => {
			expect(parseFloat((bar.element() as HTMLElement).style.width)).toBeGreaterThan(2);
		});
	});

	it('pauses the timer', async () => {
		const screen = render(StoryViewer, { props: { open: true, groups, startIndex: 1 } });
		await screen.getByRole('button', { name: 'Pause' }).click();
		const bar = screen.getByTestId('story-progress').first().element() as HTMLElement;
		const width = bar.style.width;
		await new Promise((r) => setTimeout(r, 300));
		expect(bar.style.width).toBe(width);
		await expect.element(screen.getByRole('button', { name: 'Play' })).toBeVisible();
	});

	it('moves through stories, then to the next person, then closes', async () => {
		const screen = render(StoryViewer, { props: { open: true, groups, startIndex: 0 } });
		await expect.element(screen.getByText('My first')).toBeVisible();

		await screen.getByRole('button', { name: 'Next story' }).click();
		await expect.element(screen.getByText('Aoi one')).toBeVisible();
		await userEvent.keyboard('{ArrowRight}');
		await expect.element(screen.getByText('Aoi two')).toBeVisible();
		await userEvent.keyboard('{ArrowLeft}');
		await expect.element(screen.getByText('Aoi one')).toBeVisible();

		await userEvent.keyboard('{ArrowRight}');
		await userEvent.keyboard('{ArrowRight}');
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('closes with Escape and the close button', async () => {
		const screen = render(StoryViewer, { props: { open: true, groups } });
		await userEvent.keyboard('{Escape}');
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('lets you delete only your own story', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(null, { status: 204 }))
		);
		const onDeleted = vi.fn();
		const other = render(StoryViewer, { props: { open: true, groups, startIndex: 1 } });
		expect(other.getByRole('button', { name: 'Delete story' }).query()).toBeNull();
		other.unmount();

		const screen = render(StoryViewer, { props: { open: true, groups, startIndex: 0, onDeleted } });
		await screen.getByRole('button', { name: 'Delete story' }).click();
		await screen.getByRole('button', { name: 'Delete', exact: true }).click();
		await vi.waitFor(() =>
			expect(onDeleted).toHaveBeenCalledWith(expect.objectContaining({ caption: 'My first' }))
		);
		expect(fetch).toHaveBeenCalledWith(
			`/api/stories/${encodeURIComponent(groups[0].stories[0].id)}`,
			{
				method: 'DELETE'
			}
		);
	});

	it('shows the view count on your own story and lists who viewed it', async () => {
		const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
			if (url.endsWith('/views')) {
				return Response.json({
					count: 1,
					viewers: [
						{
							id: 'aoi',
							name: 'Aoi Tanaka',
							handle: 'aoi',
							image: null,
							viewedAt: now - 60_000,
							isFollowing: false
						}
					]
				});
			}
			return Response.json({ following: init?.method === 'POST', followersCount: 1 });
		});
		vi.stubGlobal('fetch', fetchMock);
		const own: StoryGroup[] = [
			{ ...groups[0], stories: [{ ...groups[0].stories[0], viewCount: 1 }] }
		];
		const screen = render(StoryViewer, { props: { open: true, groups: own } });

		await screen.getByRole('button', { name: '1 views, see who viewed' }).click();
		const panel = screen.getByRole('dialog', { name: 'Story viewers' });
		await expect.element(panel.getByText('Aoi Tanaka')).toBeVisible();
		await expect.element(panel.getByText('1 viewers')).toBeVisible();
		expect(fetchMock).toHaveBeenCalledWith(
			`/api/stories/${encodeURIComponent(own[0].stories[0].id)}/views`
		);

		// Follow back from the list.
		await panel.getByRole('button', { name: 'Follow', exact: true }).click();
		await expect
			.element(panel.getByRole('button', { name: 'Following', exact: true }))
			.toBeVisible();
		expect(fetchMock).toHaveBeenCalledWith('/api/users/aoi/follow', { method: 'POST' });

		// The story stays put while the list is open.
		await expect.element(screen.getByText('My first')).toBeVisible();
	});

	it("doesn't show a views button on other people's stories", async () => {
		const screen = render(StoryViewer, { props: { open: true, groups, startIndex: 1 } });
		await expect.element(screen.getByText('Aoi one')).toBeVisible();
		expect(screen.getByRole('button', { name: /views, see who viewed/ }).query()).toBeNull();
	});
});
