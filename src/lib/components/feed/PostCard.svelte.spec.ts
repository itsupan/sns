import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readable } from 'svelte/store';
import PostCard, { type PostData } from './PostCard.svelte';

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
		const screen = render(PostCard);

		const likeButton = screen.getByRole('button', { name: 'Like post' });
		await expect.element(likeButton).toBeInTheDocument();
		await expect.element(screen.getByText('842')).toBeInTheDocument();

		await likeButton.click();
		await expect.element(screen.getByText('843')).toBeInTheDocument();
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
});
