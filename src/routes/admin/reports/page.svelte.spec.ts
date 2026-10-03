import { render } from 'vitest-browser-svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';
import { stubIntersectionObserver } from '../../../test/intersection-observer';

const owner = {
	id: 'alice',
	name: 'Alice',
	handle: 'alice',
	image: null,
	role: 'user',
	banned: false,
	banExpires: null
};

function item(targetType: string, targetId: string, extra: Record<string, unknown> = {}) {
	return {
		targetType,
		targetId,
		reportCount: 1,
		reasons: ['spam'],
		latestReportAt: new Date(Date.now() - 60_000),
		target: {
			owner,
			text: null,
			media: null,
			postId: null,
			parentCommentId: null,
			removed: false
		},
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
			return Response.json({ resolved: true });
		})
	);
});

afterEach(() => vi.unstubAllGlobals());

const renderPage = (items: unknown[], nextCursor: string | null = null) =>
	render(Page, { props: { data: { items, nextCursor } } as never });

describe('/admin/reports', () => {
	it('shows an empty state when nothing is open', async () => {
		const screen = renderPage([]);
		await expect.element(screen.getByText('No open reports. All caught up.')).toBeVisible();
	});

	it('shows each target with its report count, reasons and preview', async () => {
		const screen = renderPage([
			item('post', 'p-1', {
				reportCount: 3,
				reasons: ['spam', 'hate'],
				target: { ...item('post', 'p-1').target, text: 'Buy followers now', postId: 'p-1' }
			}),
			item('message', 'msg-1', { target: null })
		]);
		await expect.element(screen.getByText('3 reports')).toBeVisible();
		await expect.element(screen.getByText('Spam, Hate speech or symbols')).toBeVisible();
		await expect.element(screen.getByText('Buy followers now')).toBeVisible();
		await expect.element(screen.getByText('This content no longer exists.')).toBeVisible();
		expect(screen.getByTestId('report').elements()).toHaveLength(2);
	});

	it('offers no removal for an account, only dismiss and suspend', async () => {
		const screen = renderPage([item('user', 'alice')]);
		await expect.element(screen.getByRole('button', { name: 'Suspend user' })).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Dismiss' })).toBeVisible();
		expect(screen.getByRole('button', { name: 'Remove' }).elements()).toHaveLength(0);
	});

	it('confirms an action in a sheet, posts it and drops the resolved target', async () => {
		const screen = renderPage([item('post', 'p-1'), item('comment', 'c-1')]);
		await screen.getByRole('button', { name: 'Suspend user' }).first().click();

		const sheet = screen.getByRole('dialog', { name: 'Suspend user' });
		await expect.element(sheet).toBeVisible();
		await sheet.getByLabelText('Duration').selectOptions('30 days');
		await sheet.getByRole('textbox').fill('repeat spam');
		await sheet.getByRole('button', { name: 'Suspend' }).click();

		await expect.poll(() => screen.getByTestId('report').elements().length).toBe(1);
		expect(calls).toEqual([
			{
				url: '/api/admin/reports/resolve',
				body: {
					targetType: 'post',
					targetId: 'p-1',
					action: 'suspend_user',
					durationDays: 30,
					note: 'repeat spam'
				}
			}
		]);
	});

	it('loads the next page while scrolling', async () => {
		stubIntersectionObserver();
		vi.mocked(fetch).mockResolvedValueOnce(
			Response.json({ items: [item('comment', 'c-9')], nextCursor: null })
		);
		const screen = renderPage([item('post', 'p-1')], 'cursor-1');
		await expect.poll(() => screen.getByTestId('report').elements().length).toBe(2);
		expect(fetch).toHaveBeenCalledWith('/api/admin/reports?cursor=cursor-1');
	});
});
