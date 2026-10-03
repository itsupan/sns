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

	it('opens the viewers list and the delete confirmation as dialogs of their own', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Response.json({ count: 0, viewers: [] }))
		);
		const screen = render(StoryViewer, { props: { open: true, groups } });
		const viewer = screen.getByRole('dialog', { name: 'Stories from Me' });

		const views = screen.getByRole('button', { name: '0 views, see who viewed' });
		await views.click();
		const panel = screen.getByRole('dialog', { name: 'Story viewers' });
		await expect.element(panel.getByText('No one has viewed this story yet.')).toBeVisible();
		// Arrows in the list don't move the story on.
		await userEvent.keyboard('{ArrowRight}');
		await userEvent.keyboard('{Escape}');
		await expect.element(panel).not.toBeInTheDocument();
		await expect.element(screen.getByText('My first')).toBeVisible();
		await expect.element(views).toHaveFocus();

		const remove = screen.getByRole('button', { name: 'Delete story' });
		await remove.click();
		const confirm = screen.getByRole('dialog', { name: 'Delete this story?' });
		await expect.element(confirm).toBeVisible();
		await userEvent.keyboard('{Escape}');
		await expect.element(confirm).not.toBeInTheDocument();
		await expect.element(viewer).toBeVisible();
		await expect.element(remove).toHaveFocus();
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
							reaction: '🔥',
							isFollowing: false
						}
					]
				});
			}
			return Response.json({
				status: init?.method === 'POST' ? 'following' : 'none',
				followersCount: 1
			});
		});
		vi.stubGlobal('fetch', fetchMock);
		const own: StoryGroup[] = [
			{ ...groups[0], stories: [{ ...groups[0].stories[0], viewCount: 1 }] }
		];
		const screen = render(StoryViewer, { props: { open: true, groups: own } });

		await screen.getByRole('button', { name: '1 view, see who viewed' }).click();
		const panel = screen.getByRole('dialog', { name: 'Story viewers' });
		await expect.element(panel.getByText('Aoi Tanaka')).toBeVisible();
		await expect.element(panel.getByText('1 viewer', { exact: true })).toBeVisible();
		await expect.element(panel.getByLabelText('Reacted 🔥')).toBeVisible();
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

	it('shows the server view count and loads more viewers page by page', async () => {
		const person = (id: string) => ({
			id,
			name: `Viewer ${id}`,
			handle: null,
			image: null,
			viewedAt: now - 60_000,
			reaction: null,
			isFollowing: false
		});
		const fetchMock = vi.fn(async (url: string) =>
			url.endsWith('?cursor=next')
				? Response.json({ count: 3, viewers: [person('c')], nextCursor: null })
				: Response.json({ count: 3, viewers: [person('a'), person('b')], nextCursor: 'next' })
		);
		vi.stubGlobal('fetch', fetchMock);
		const own: StoryGroup[] = [
			{ ...groups[0], stories: [{ ...groups[0].stories[0], viewCount: 1 }] }
		];
		const screen = render(StoryViewer, { props: { open: true, groups: own } });

		await screen.getByRole('button', { name: '1 view, see who viewed' }).click();
		const panel = screen.getByRole('dialog', { name: 'Story viewers' });
		await expect.element(panel.getByText('3 viewers', { exact: true })).toBeVisible();
		await expect.element(panel.getByText('Viewer c')).toBeVisible();
		expect(fetchMock).toHaveBeenCalledWith(
			`/api/stories/${encodeURIComponent(own[0].stories[0].id)}/views?cursor=next`
		);
		expect(panel.getByRole('listitem').elements()).toHaveLength(3);
	});

	it('sends a reaction and toggles it off with a second tap', async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => Response.json({}));
		vi.stubGlobal('fetch', fetchMock);
		const screen = render(StoryViewer, { props: { open: true, groups, startIndex: 1 } });
		const url = `/api/stories/${encodeURIComponent(groups[1].stories[0].id)}/react`;
		const sent = () => JSON.parse(String(fetchMock.mock.lastCall?.[1]?.body));

		const fire = screen.getByRole('button', { name: 'React 🔥' });
		await fire.click();
		await expect.element(fire).toHaveAttribute('aria-pressed', 'true');
		expect(fetchMock).toHaveBeenLastCalledWith(url, expect.objectContaining({ method: 'POST' }));
		expect(sent()).toEqual({ reaction: '🔥' });

		await fire.click();
		await expect.element(fire).toHaveAttribute('aria-pressed', 'false');
		expect(sent()).toEqual({ reaction: null });
	});

	it('shows a reaction saved earlier and clears it with a tap', async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => Response.json({}));
		vi.stubGlobal('fetch', fetchMock);
		const reacted: StoryGroup[] = [
			groups[0],
			{ ...groups[1], stories: [{ ...groups[1].stories[0], reaction: '😂' }, groups[1].stories[1]] }
		];
		const screen = render(StoryViewer, { props: { open: true, groups: reacted, startIndex: 1 } });

		const laugh = screen.getByRole('button', { name: 'React 😂' });
		await expect.element(laugh).toHaveAttribute('aria-pressed', 'true');
		await laugh.click();
		await expect.element(laugh).toHaveAttribute('aria-pressed', 'false');
		expect(JSON.parse(String(fetchMock.mock.lastCall?.[1]?.body))).toEqual({ reaction: null });
	});

	it('replies to a story without moving on while typing', async () => {
		const fetchMock = vi.fn(async () => Response.json({}, { status: 201 }));
		vi.stubGlobal('fetch', fetchMock);
		const screen = render(StoryViewer, { props: { open: true, groups, startIndex: 1 } });

		const input = screen.getByRole('textbox', { name: 'Reply to Aoi' });
		await input.fill('So good');
		await userEvent.keyboard('{ArrowRight}');
		await expect.element(screen.getByText('Aoi one')).toBeVisible();

		await screen.getByRole('button', { name: 'Send' }).click();
		await expect.element(input).toHaveValue('');
		expect(fetchMock).toHaveBeenCalledWith(
			`/api/stories/${encodeURIComponent(groups[1].stories[0].id)}/reply`,
			expect.objectContaining({ method: 'POST', body: JSON.stringify({ content: 'So good' }) })
		);
	});

	it("doesn't show reactions or a reply box on your own story", async () => {
		const screen = render(StoryViewer, { props: { open: true, groups, startIndex: 0 } });
		await expect.element(screen.getByText('My first')).toBeVisible();
		expect(screen.getByRole('button', { name: 'React 🔥' }).query()).toBeNull();
		expect(screen.getByRole('textbox', { name: /Reply to/ }).query()).toBeNull();
	});

	it("doesn't show a views button on other people's stories", async () => {
		const screen = render(StoryViewer, { props: { open: true, groups, startIndex: 1 } });
		await expect.element(screen.getByText('Aoi one')).toBeVisible();
		expect(screen.getByRole('button', { name: /views, see who viewed/ }).query()).toBeNull();
	});
});
