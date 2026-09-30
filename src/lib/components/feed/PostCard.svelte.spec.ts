import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readable } from 'svelte/store';
import PostCard, { type PostData } from './PostCard.svelte';
// Tailwind's line-clamp must apply for "See more" to measure a real overflow.
import '../../../app.css';

// Signed in as `owner-1`; the default demo post has no author id, so it is never "own".
vi.mock('$lib/auth-client', () => ({
	authClient: {
		useSession: () =>
			readable({ data: { user: { id: 'owner-1', name: 'Owner' } }, isPending: false })
	}
}));

const ownPost: PostData = {
	id: 'own-1',
	author: { id: 'owner-1', name: 'Owner', handle: '@owner', avatar: '' },
	title: 'My study',
	description: 'Original caption',
	image: '',
	tags: ['#Film'],
	likes: 0,
	commentsCount: 0,
	repostsCount: 0
};

afterEach(() => vi.unstubAllGlobals());

describe('PostCard component', () => {
	it('renders author info, title, and location', async () => {
		const screen = render(PostCard);

		await expect.element(screen.getByText('Elena Rostova')).toBeInTheDocument();
		await expect
			.element(screen.getByText('Quiet Brutalism: Concrete Light & Shadows'))
			.toBeInTheDocument();
		await expect.element(screen.getByText('Fondazione Prada, Milano')).toBeInTheDocument();
	});

	it('toggles like button on click', async () => {
		const like = vi.fn(async () => Response.json({ liked: true, likesCount: 843 }));
		vi.stubGlobal('fetch', like);
		const screen = render(PostCard);

		const likeButton = screen.getByRole('button', { name: 'Like post' });
		await expect.element(likeButton).toBeInTheDocument();
		await expect.element(screen.getByText('842')).toBeInTheDocument();

		await likeButton.click();
		await expect.element(screen.getByText('843')).toBeInTheDocument();
		expect(like).toHaveBeenCalledWith('/api/posts/post-1/like', { method: 'POST' });
	});

	it('rolls the like back when the server rejects it', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Response.json({ error: { code: 'rate_limited' } }, { status: 429 }))
		);
		const screen = render(PostCard);

		await screen.getByRole('button', { name: 'Like post' }).click();
		await expect.element(screen.getByRole('button', { name: 'Like post' })).toBeInTheDocument();
		await expect.element(screen.getByText('842')).toBeInTheDocument();
	});

	it('ignores a second like tap while the first is in flight and takes the count from the server', async () => {
		let release!: (res: Response) => void;
		const like = vi.fn(() => new Promise<Response>((resolve) => (release = resolve)));
		vi.stubGlobal('fetch', like);
		const screen = render(PostCard);

		const likeButton = screen.getByRole('button', { name: 'Like post' });
		await likeButton.click();
		await likeButton.click();
		expect(like).toHaveBeenCalledTimes(1);

		release(Response.json({ liked: true, likesCount: 850 }));
		await expect.element(screen.getByText('850')).toBeInTheDocument();
		await expect.element(likeButton).toHaveAttribute('aria-pressed', 'true');
	});

	it('keeps line breaks and expands a long description with See more', async () => {
		const description = Array.from({ length: 30 }, (_, i) => `Paragraph ${i + 1}`).join('\n\n');
		const screen = render(PostCard, { post: { ...ownPost, description } });

		await expect
			.element(screen.getByText('Paragraph 1', { exact: false }).first())
			.toHaveClass('whitespace-pre-line');
		const more = screen.getByRole('button', { name: 'See more' });
		await expect.element(more).toHaveAttribute('aria-expanded', 'false');
		await more.click();
		await expect
			.element(screen.getByRole('button', { name: 'See less' }))
			.toHaveAttribute('aria-expanded', 'true');
	});

	it('shows no See more for a short description or on the post page', async () => {
		render(PostCard, { post: ownPost });
		const description = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`).join('\n');
		render(PostCard, { post: { ...ownPost, id: 'own-2', description }, fullText: true });

		await new Promise((r) => setTimeout(r, 50));
		expect(document.querySelector('[aria-expanded]')).toBeNull();
	});

	it('saves and unsaves through the API, sending only the final state after fast taps', async () => {
		let release!: () => void;
		const gate = new Promise<void>((r) => (release = r));
		const calls: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string, init?: RequestInit) => {
				calls.push(`${init?.method} ${url}`);
				if (calls.length === 1) await gate;
				return Response.json({ saved: init?.method === 'PUT' });
			})
		);
		const screen = render(PostCard);

		await screen.getByRole('button', { name: 'Save bookmark' }).click();
		// While the save is in flight: unsave, then save again.
		await screen.getByRole('button', { name: 'Remove bookmark' }).click();
		await screen.getByRole('button', { name: 'Save bookmark' }).click();
		release();

		await expect.element(screen.getByRole('button', { name: 'Remove bookmark' })).toBeVisible();
		await vi.waitFor(() => expect(calls).toEqual(['PUT /api/posts/post-1/save']));
	});

	it('rolls the save back when the server rejects it', async () => {
		const save = vi.fn(async () =>
			Response.json({ error: { code: 'not_found', message: 'Post not found' } }, { status: 404 })
		);
		vi.stubGlobal('fetch', save);
		const screen = render(PostCard);

		await screen.getByRole('button', { name: 'Save bookmark' }).click();
		await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
		await expect.element(screen.getByRole('button', { name: 'Save bookmark' })).toBeVisible();
	});

	it('renders multi-image carousel counter and navigates slides', async () => {
		const screen = render(PostCard);

		await expect.element(screen.getByText('1/4')).toBeInTheDocument();

		const nextButton = screen.getByRole('button', { name: 'Next slide' });
		await expect.element(nextButton).toBeInTheDocument();

		await nextButton.click();
		await expect.element(screen.getByText('2/4')).toBeInTheDocument();
	});

	it('hides edit and delete from people who did not write the post', async () => {
		const screen = render(PostCard);
		await screen.getByRole('button', { name: 'Post options' }).click();
		await expect.element(screen.getByText('Report')).toBeInTheDocument();
		expect(screen.getByText('Edit post').query()).toBeNull();
		expect(screen.getByText('Delete post').query()).toBeNull();
	});

	it('opens the same composer fields to edit, pre-filled, and saves in place', async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({
				post: {
					title: 'My study',
					description: 'Updated caption',
					tags: ['#Film'],
					image: '',
					mediaType: 'none',
					mediaItems: [],
					aspectRatio: '1:1',
					postType: 'photo'
				}
			})
		);
		vi.stubGlobal('fetch', fetchMock);
		const screen = render(PostCard, {
			props: { post: { ...ownPost, image: 'https://example.com/a.jpg' } }
		});

		await screen.getByRole('button', { name: 'Post options' }).click();
		await expect.element(screen.getByText('Report')).not.toBeInTheDocument();
		await screen.getByText('Edit post').click();

		const dialog = screen.getByRole('dialog', { name: 'Edit post' });
		// Same controls as "Create post": post type, media tray, ratio, caption, location, tags.
		await expect.element(dialog.getByRole('radio', { name: /Article/i })).toBeInTheDocument();
		await expect.element(dialog.getByText('Canvas Ratio')).toBeInTheDocument();
		await expect.element(dialog.getByRole('button', { name: 'Remove plate' })).toBeInTheDocument();
		await expect.element(dialog.getByText('#Film')).toBeInTheDocument();

		await dialog.getByRole('button', { name: 'Remove plate' }).click();
		await dialog.getByLabelText('Post content').fill('Updated caption');
		await dialog.getByRole('button', { name: 'Save changes' }).click();

		await expect.element(screen.getByText('Updated caption')).toBeInTheDocument();
		const calls = fetchMock.mock.calls as unknown as [string, RequestInit | undefined][];
		const [, init] = calls.find(([, i]) => i?.method === 'PATCH')!;
		expect(JSON.parse(init!.body as string)).toMatchObject({
			content: 'Updated caption',
			mediaUrls: [],
			tags: ['#Film']
		});
	});

	it('lets the author delete the post after confirming', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(null, { status: 204 }))
		);
		const onDelete = vi.fn();
		const screen = render(PostCard, { props: { post: ownPost, onDelete } });

		await screen.getByRole('button', { name: 'Post options' }).click();
		await screen.getByText('Delete post').click();
		await screen.getByRole('button', { name: 'Delete', exact: true }).click();

		await expect.element(screen.getByText('Original caption')).not.toBeInTheDocument();
		expect(onDelete).toHaveBeenCalledWith('own-1');
	});

	const otherPost: PostData = {
		...ownPost,
		id: 'other-1',
		author: { id: 'author-9', name: 'Aoi', handle: '@aoi', avatar: '', isFollowing: false }
	};

	it('links the author to their profile, and your own posts to /profile', async () => {
		const other = render(PostCard, { props: { post: otherPost } });
		await expect
			.element(other.getByRole('link', { name: 'Aoi', exact: true }))
			.toHaveAttribute('href', '/profile/author-9');
		await expect
			.element(other.getByRole('link', { name: "View Aoi's profile" }))
			.toHaveAttribute('href', '/profile/author-9');
		other.unmount();

		const own = render(PostCard, { props: { post: ownPost } });
		await expect
			.element(own.getByRole('link', { name: 'Owner', exact: true }))
			.toHaveAttribute('href', '/profile');
		// No follow button on your own post.
		expect(own.getByRole('button', { name: 'Follow', exact: true }).query()).toBeNull();
	});

	it('follows and unfollows the author, keeping every card by them in sync', async () => {
		const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
			Response.json({ following: init?.method === 'POST', followersCount: 1 })
		);
		vi.stubGlobal('fetch', fetchMock);
		const screen = render(PostCard, { props: { post: otherPost } });
		render(PostCard, { props: { post: { ...otherPost, id: 'other-2' } } });

		const follow = screen.getByRole('button', { name: 'Follow', exact: true });
		const following = screen.getByRole('button', { name: 'Following', exact: true });
		await expect.element(follow.nth(1)).toBeInTheDocument();

		await follow.first().click();
		// Both cards by the same author switch together.
		await expect.element(following.nth(1)).toBeInTheDocument();
		expect(follow.query()).toBeNull();
		expect(fetchMock).toHaveBeenCalledWith('/api/users/author-9/follow', { method: 'POST' });

		await following.nth(1).click();
		await expect.element(follow.nth(1)).toBeInTheDocument();
		expect(following.query()).toBeNull();
		expect(fetchMock).toHaveBeenCalledWith('/api/users/author-9/follow', { method: 'DELETE' });
	});

	it('rolls back the follow button when the request fails', async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({ error: { code: 'rate_limited', message: 'Slow down' } }, { status: 429 })
		);
		vi.stubGlobal('fetch', fetchMock);
		const screen = render(PostCard, {
			props: { post: { ...otherPost, author: { ...otherPost.author, id: 'author-10' } } }
		});
		await screen.getByRole('button', { name: 'Follow', exact: true }).click();
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
		await expect
			.element(screen.getByRole('button', { name: 'Follow', exact: true }))
			.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Following', exact: true }).query()).toBeNull();
	});
});
