import { render } from 'vitest-browser-svelte';
import { readable } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PostCommentsModal, { type CommentItem } from './PostCommentsModal.svelte';
import type { PostData } from './PostCard.svelte';
import { toast } from '$lib/utils/toast.svelte';

// Signed in as `viewer`; the post belongs to `elena`.
vi.mock('$lib/auth-client', () => ({
	authClient: {
		useSession: () =>
			readable({ data: { user: { id: 'viewer', name: 'Viewer' } }, isPending: false })
	}
}));

const testPost: PostData = {
	id: 'post-1',
	author: { id: 'elena', name: 'Elena Rostova', handle: '@elena.rostova', avatar: '' },
	title: 'Quiet Brutalism',
	description: 'A study on light and shadow.',
	image: '',
	tags: [],
	likes: 0,
	commentsCount: 3,
	repostsCount: 0
};

function makeComment(id: string, overrides: Partial<CommentItem> = {}): CommentItem {
	return {
		id,
		parentCommentId: null,
		content: `comment ${id}`,
		createdAt: new Date().toISOString(),
		timeAgo: '1m ago',
		repliesCount: 0,
		reactions: { counts: {}, mine: [] },
		canDelete: false,
		author: { id: 'marcus', name: 'Marcus', handle: '@marcus_k', avatar: '' },
		...overrides
	};
}

type Route = (init: RequestInit | undefined) => { status?: number; body: unknown };
let routes: Record<string, Route>;
let calls: Array<{ key: string; body: unknown }>;

/** Routes fetches by "METHOD path" (query string ignored) and records each call. */
beforeEach(() => {
	calls = [];
	routes = {};
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = new URL(String(input), 'http://localhost');
			const key = `${init?.method ?? 'GET'} ${url.pathname}`;
			calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : undefined });
			const route = routes[key];
			if (!route) return new Response('{}', { status: 404 });
			const { status = 200, body } = route(init);
			return new Response(JSON.stringify(body), { status });
		})
	);
});

afterEach(() => vi.unstubAllGlobals());

const page =
	(comments: CommentItem[], nextCursor: string | null = null) =>
	() => ({
		body: { comments, hasMore: nextCursor !== null, nextCursor }
	});

describe('PostCommentsModal', () => {
	it('renders the dialog with the post total and the composer', async () => {
		routes['GET /api/posts/post-1/comments'] = page([]);
		const screen = render(PostCommentsModal, { props: { open: true, post: testPost } });

		await expect.element(screen.getByText('Comments (3)')).toBeInTheDocument();
		await expect.element(screen.getByText('No comments yet')).toBeInTheDocument();
		await expect.element(screen.getByPlaceholder('Add a comment...')).toBeInTheDocument();
	});

	it('marks the post author by id, not by name', async () => {
		routes['GET /api/posts/post-1/comments'] = page([
			makeComment('c1', { author: { id: 'elena', name: 'Someone', handle: '@x', avatar: '' } }),
			makeComment('c2', {
				author: { id: 'impostor', name: 'Elena Rostova', handle: '@y', avatar: '' }
			})
		]);
		const screen = render(PostCommentsModal, { props: { open: true, post: testPost } });

		await expect.element(screen.getByText('comment c2')).toBeInTheDocument();
		expect(screen.getByText('Author').elements()).toHaveLength(1);
	});

	it('loads replies on demand and pages through them', async () => {
		routes['GET /api/posts/post-1/comments'] = page([makeComment('c1', { repliesCount: 3 })]);
		let replyPage = 0;
		routes['GET /api/comments/c1/replies'] = () =>
			replyPage++ === 0
				? {
						body: {
							comments: [makeComment('r1', { parentCommentId: 'c1' })],
							nextCursor: 'next'
						}
					}
				: {
						body: {
							comments: [
								makeComment('r2', { parentCommentId: 'c1' }),
								makeComment('r3', { parentCommentId: 'c1' })
							],
							nextCursor: null
						}
					};
		const screen = render(PostCommentsModal, { props: { open: true, post: testPost } });

		await screen.getByRole('button', { name: 'View 3 replies' }).click();
		await expect.element(screen.getByText('comment r1')).toBeInTheDocument();

		await screen.getByRole('button', { name: 'View 2 more replies' }).click();
		await expect.element(screen.getByText('comment r3')).toBeInTheDocument();
		expect(calls.filter((c) => c.key === 'GET /api/comments/c1/replies')).toHaveLength(2);

		await screen.getByRole('button', { name: 'Hide replies' }).click();
		await expect.element(screen.getByText('comment r1')).not.toBeInTheDocument();
	});

	it('replying to a reply attaches to its top-level comment', async () => {
		routes['GET /api/posts/post-1/comments'] = page([makeComment('c1', { repliesCount: 1 })]);
		routes['GET /api/comments/c1/replies'] = page([makeComment('r1', { parentCommentId: 'c1' })]);
		routes['POST /api/posts/post-1/comments'] = () => ({
			status: 201,
			body: {
				comment: makeComment('r2', {
					parentCommentId: 'c1',
					content: 'my reply',
					canDelete: true,
					author: { id: 'viewer', name: 'Viewer', handle: '@viewer', avatar: '' }
				}),
				commentsCount: 5,
				repliesCount: 2
			}
		});
		const screen = render(PostCommentsModal, { props: { open: true, post: testPost } });

		await screen.getByRole('button', { name: 'View 1 reply' }).click();
		await expect.element(screen.getByText('comment r1')).toBeInTheDocument();
		await screen.getByTestId('comment-r1').getByRole('button', { name: 'Reply' }).click();

		const input = screen.getByPlaceholder('Reply to @marcus_k...');
		await input.fill('@marcus_k my reply');
		await screen.getByRole('button', { name: 'Post' }).click();

		await expect.element(screen.getByText('my reply')).toBeInTheDocument();
		await expect.element(screen.getByText('Comments (5)')).toBeInTheDocument();
		expect(calls.find((c) => c.key === 'POST /api/posts/post-1/comments')?.body).toEqual({
			content: '@marcus_k my reply',
			parentCommentId: 'c1'
		});
	});

	it('toggles a reaction optimistically and keeps the server summary', async () => {
		routes['GET /api/posts/post-1/comments'] = page([makeComment('c1')]);
		routes['POST /api/comments/c1/reactions'] = () => ({
			body: { reacted: true, reactions: { counts: { love: 2 }, mine: ['love'] } }
		});
		const screen = render(PostCommentsModal, { props: { open: true, post: testPost } });

		await screen.getByRole('button', { name: 'Add reaction' }).click();
		await screen.getByRole('button', { name: 'Love', exact: true }).click();

		await expect
			.element(screen.getByRole('button', { name: 'Love: 2, remove your reaction' }))
			.toHaveAttribute('aria-pressed', 'true');
		expect(calls.find((c) => c.key === 'POST /api/comments/c1/reactions')?.body).toEqual({
			type: 'love'
		});
	});

	it('rolls a reaction back when the server rejects it', async () => {
		routes['GET /api/posts/post-1/comments'] = page([
			makeComment('c1', { reactions: { counts: { fire: 1 }, mine: [] } })
		]);
		routes['POST /api/comments/c1/reactions'] = () => ({
			status: 429,
			body: { error: { code: 'rate_limited', message: 'Slow down' } }
		});
		const screen = render(PostCommentsModal, { props: { open: true, post: testPost } });

		await screen.getByRole('button', { name: 'Fire: 1' }).click();
		await expect.element(screen.getByRole('button', { name: 'Fire: 1' })).toBeInTheDocument();
		await expect.poll(() => toast.current?.text).toBe('Slow down');
	});

	it('deletes a comment after a second tap and updates the total', async () => {
		routes['GET /api/posts/post-1/comments'] = page([
			makeComment('c1', { canDelete: true }),
			makeComment('c2')
		]);
		routes['DELETE /api/comments/c1'] = () => ({
			body: { commentsCount: 1, parentCommentId: null, repliesCount: null }
		});
		const onCommentDeleted = vi.fn();
		const screen = render(PostCommentsModal, {
			props: { open: true, post: testPost, onCommentDeleted }
		});

		// Only c1 is deletable by the viewer.
		await expect.element(screen.getByText('comment c2')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Delete' }).elements()).toHaveLength(1);

		await screen.getByRole('button', { name: 'Delete' }).click();
		expect(calls.some((c) => c.key === 'DELETE /api/comments/c1')).toBe(false);
		await screen.getByRole('button', { name: 'Tap again to delete' }).click();

		await expect.element(screen.getByText('comment c1')).not.toBeInTheDocument();
		await expect.element(screen.getByText('Comments (1)')).toBeInTheDocument();
		expect(onCommentDeleted).toHaveBeenCalledWith('c1', 1);
	});

	it('pages top-level comments with Load more', async () => {
		let n = 0;
		routes['GET /api/posts/post-1/comments'] = () =>
			n++ === 0
				? { body: { comments: [makeComment('c1')], nextCursor: 'cur' } }
				: { body: { comments: [makeComment('c2')], nextCursor: null } };
		const screen = render(PostCommentsModal, { props: { open: true, post: testPost } });

		await screen.getByRole('button', { name: 'Load more comments' }).click();
		await expect.element(screen.getByText('comment c2')).toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: 'Load more comments' }))
			.not.toBeInTheDocument();
	});

	it('shows a retry when comments fail to load', async () => {
		routes['GET /api/posts/post-1/comments'] = () => ({
			status: 500,
			body: { error: { code: 'internal', message: 'Server is down' } }
		});
		const screen = render(PostCommentsModal, { props: { open: true, post: testPost } });

		await expect.element(screen.getByText('Server is down')).toBeInTheDocument();
		routes['GET /api/posts/post-1/comments'] = page([makeComment('c1')]);
		await screen.getByRole('button', { name: 'Try again' }).click();
		await expect.element(screen.getByText('comment c1')).toBeInTheDocument();
	});
});
