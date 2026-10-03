import { render } from 'vitest-browser-svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';
import type { InboxItem } from '$lib/chat/types';
import { stubIntersectionObserver } from '../../test/intersection-observer';

const chat = (id: string, name: string): InboxItem => ({
	id,
	other: { id: `u-${id}`, name, handle: `@${name}`, slug: name, image: null },
	lastMessage: { content: `hi from ${name}`, senderId: `u-${id}`, createdAt: 5000 },
	unreadCount: 0
});

let urls: string[];

beforeEach(() => {
	urls = [];
	stubIntersectionObserver();
});

afterEach(() => vi.unstubAllGlobals());

function stubInbox(respond: () => Response) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string) => {
			urls.push(url);
			return respond();
		})
	);
}

const renderPage = (conversations: InboxItem[], nextCursor: string | null) =>
	render(Page, { props: { data: { viewerId: 'me', conversations, nextCursor } } as never });

describe('/messages', () => {
	it('loads older conversations with the cursor when scrolled to the end, skipping repeats', async () => {
		stubInbox(() =>
			Response.json({ conversations: [chat('c1', 'Ann'), chat('c2', 'Zed')], nextCursor: null })
		);
		const screen = renderPage([chat('c1', 'Ann')], 'older');

		await expect.element(screen.getByText('Zed', { exact: true })).toBeVisible();
		expect(urls).toEqual(['/api/conversations?cursor=older']);
		expect(screen.getByRole('listitem').elements()).toHaveLength(2);
	});

	it('shows a failed page with a retry', async () => {
		let fail = true;
		stubInbox(() =>
			fail
				? Response.json({ error: { code: 'internal', message: 'Server hiccup' } }, { status: 500 })
				: Response.json({ conversations: [chat('c2', 'Zed')], nextCursor: null })
		);
		const screen = renderPage([chat('c1', 'Ann')], 'older');
		await expect.element(screen.getByRole('alert')).toHaveTextContent('Server hiccup');

		fail = false;
		await screen.getByRole('button', { name: 'Try again' }).click();
		await expect.element(screen.getByText('Zed', { exact: true })).toBeVisible();
		expect(urls).toEqual(['/api/conversations?cursor=older', '/api/conversations?cursor=older']);
	});
});
