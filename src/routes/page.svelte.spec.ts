import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';

describe('home page', () => {
	it('shows the app name and feed layout components', async () => {
		const screen = render(Page);

		await expect
			.element(screen.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Kizuna home feed');
		await expect
			.element(screen.getByText('Quiet Brutalism: Concrete Light & Shadows'))
			.toBeInTheDocument();
		await expect.element(screen.getByText('Your story')).toBeInTheDocument();
		await expect.element(screen.getByText('Curators to Follow')).toBeInTheDocument();
	});

	it('shows "You\'re all caught up" indicator when no more posts exist', async () => {
		const screen = render(Page, {
			props: {
				data: {
					posts: [
						{
							id: 'post-test-1',
							author: {
								name: 'Elena Rostova',
								handle: '@elena.rostova',
								avatar: 'https://example.com/avatar.jpg'
							},
							title: 'Single Post',
							description: 'Test post description',
							image: 'https://example.com/test.jpg',
							tags: ['#test'],
							likes: 5,
							commentsCount: 1,
							repostsCount: 0
						}
					],
					hasMore: false,
					nextCursor: null,
					pageSize: 10
				}
			}
		});

		await expect.element(screen.getByText("You're all caught up")).toBeInTheDocument();
		await expect
			.element(screen.getByText("You've seen all recent posts from your feed."))
			.toBeInTheDocument();
	});

	describe('infinite scroll', () => {
		afterEach(() => vi.unstubAllGlobals());

		it('pages with nextCursor and stops when it is null', async () => {
			const fetchMock = mockFeedApi(() =>
				Response.json({ posts: [makePost('page-2')], hasMore: false, nextCursor: null })
			);
			const screen = render(Page, {
				props: {
					data: { posts: [makePost('page-1')], hasMore: true, nextCursor: '1700_p1', pageSize: 1 }
				}
			});
			await scrollUntilFetched(fetchMock);

			await expect.element(screen.getByText('Title page-2')).toBeInTheDocument();
			await expect.element(screen.getByText("You're all caught up")).toBeInTheDocument();
			expect(fetchMock.calls).toEqual(['/api/posts?limit=1&cursor=1700_p1']);
		});

		it('shows the API error and a retry button instead of looping', async () => {
			const fetchMock = mockFeedApi(() =>
				Response.json(
					{ error: { code: 'validation_failed', message: 'Invalid cursor' } },
					{ status: 400 }
				)
			);
			const screen = render(Page, {
				props: {
					data: { posts: [makePost('page-1')], hasMore: true, nextCursor: 'bad', pageSize: 1 }
				}
			});
			await scrollUntilFetched(fetchMock);

			await expect.element(screen.getByText('Invalid cursor')).toBeInTheDocument();
			await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
			await new Promise((r) => setTimeout(r, 300));
			expect(fetchMock.calls).toHaveLength(1);
		});
	});
});

function makePost(id: string) {
	return {
		id,
		author: { name: 'Elena Rostova', handle: '@elena.rostova', avatar: '' },
		title: `Title ${id}`,
		description: 'd',
		image: '',
		tags: [],
		likes: 0,
		commentsCount: 0,
		repostsCount: 0
	};
}

/** Stubs fetch for /api/posts only; other components' requests get an empty 200. */
function mockFeedApi(respond: () => Response) {
	const calls: string[] = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (!url.startsWith('/api/posts')) return Response.json({});
			calls.push(url);
			return respond();
		})
	);
	return { calls };
}

// The sentinel sits below the stories bar, composer and first card, outside the test viewport,
// and may mount after render, so keep scrolling it into view until the feed request fires.
async function scrollUntilFetched(mock: { calls: string[] }) {
	await expect
		.poll(
			() => {
				document.querySelector('[data-testid="feed-sentinel"]')?.scrollIntoView();
				return mock.calls.length;
			},
			{ timeout: 10_000 }
		)
		.toBeGreaterThan(0);
}
