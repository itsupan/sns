import { render } from 'vitest-browser-svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';
import type { ActivityItem } from '$lib/activity/types';
import { stubIntersectionObserver } from '../../test/intersection-observer';

const person = (id: string) => ({ id, name: id, handle: `@${id}`, slug: id, image: null });
const post = { id: 'p1', thumbnail: null };

function item(
	id: string,
	type: ActivityItem['type'],
	actor: string,
	extra: Partial<ActivityItem> = {}
): ActivityItem {
	return {
		id,
		type,
		createdAt: 5000,
		unread: false,
		actor: person(actor),
		post: null,
		comment: null,
		...extra
	};
}

let calls: Array<{ url: string; body: unknown }>;

beforeEach(() => {
	calls = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, init?: RequestInit) => {
			calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
			if (url.startsWith('/api/notifications?'))
				return Response.json({ items: [item('n9', 'follow', 'Zed')], nextCursor: null });
			if (url === '/api/badges') return Response.json({ messages: 0, activity: 0 });
			return Response.json({ ok: true });
		})
	);
});

afterEach(() => vi.unstubAllGlobals());

const renderPage = (items: ActivityItem[], nextCursor: string | null = null) =>
	render(Page, { props: { data: { items, nextCursor } } as never });

describe('/activity', () => {
	it('groups likes on the same post and shows comment text', async () => {
		const screen = renderPage([
			item('n1', 'like', 'Bob', { post, createdAt: 9000 }),
			item('n2', 'like', 'Carol', { post }),
			item('n3', 'like', 'Dan', { post }),
			item('n4', 'comment', 'Erin', { post, comment: { id: 'c1', content: 'Lovely light' } })
		]);
		await expect.element(screen.getByText('Bob and 2 others')).toBeVisible();
		await expect.element(screen.getByText('“Lovely light”')).toBeVisible();
		expect(screen.getByTestId('activity').elements()).toHaveLength(2);
	});

	it('marks what it shows as read, up to the newest item, then refreshes the badge', async () => {
		renderPage([item('n1', 'follow', 'Bob', { unread: true, createdAt: 9000 })]);
		await vi.waitFor(() =>
			expect(calls.map((c) => c.url)).toEqual(['/api/notifications/read', '/api/badges'])
		);
		expect(calls[0].body).toEqual({ upTo: 9000 });
	});

	it('does not mark read when nothing is new', async () => {
		renderPage([item('n1', 'follow', 'Bob')]);
		await new Promise((r) => setTimeout(r, 50));
		expect(calls).toEqual([]);
	});

	it('loads the next page with the cursor when scrolled to the end, then stops', async () => {
		stubIntersectionObserver();
		const screen = renderPage([item('n1', 'like', 'Bob', { post })], 'next');
		await expect.element(screen.getByText('Zed')).toBeVisible();
		expect(calls.map((c) => c.url)).toEqual(['/api/notifications?cursor=next']);
	});

	it('shows a failed page with a retry', async () => {
		stubIntersectionObserver();
		let fail = true;
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				fail
					? Response.json(
							{ error: { code: 'internal', message: 'Server hiccup' } },
							{ status: 500 }
						)
					: Response.json({ items: [item('n9', 'follow', 'Zed')], nextCursor: null })
			)
		);
		const screen = renderPage([item('n1', 'like', 'Bob', { post })], 'next');
		await expect.element(screen.getByRole('alert')).toHaveTextContent('Server hiccup');

		fail = false;
		await screen.getByRole('button', { name: 'Try again' }).click();
		await expect.element(screen.getByText('Zed')).toBeVisible();
		await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
	});

	it('shows an empty state', async () => {
		const screen = renderPage([]);
		await expect.element(screen.getByText('No activity yet')).toBeVisible();
	});
});
