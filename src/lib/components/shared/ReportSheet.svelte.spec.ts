import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReportSheet from './ReportSheet.svelte';
import { toast } from '$lib/utils/toast.svelte';

afterEach(() => {
	vi.unstubAllGlobals();
	toast.dismiss();
});

describe('ReportSheet', () => {
	it('lists the reasons and keeps Submit disabled until one is chosen', async () => {
		const screen = render(ReportSheet, {
			props: { open: true, targetType: 'user', targetId: 'u-1' }
		});

		await expect
			.element(screen.getByRole('dialog', { name: 'Report account' }))
			.toBeInTheDocument();
		expect(screen.getByRole('radio').all()).toHaveLength(9);
		await expect.element(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();

		await screen.getByRole('radio', { name: 'Spam' }).click();
		await expect.element(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
	});

	it('posts the report, closes and shows a toast', async () => {
		const fetchMock = vi.fn(async () => Response.json({ reported: true }, { status: 201 }));
		vi.stubGlobal('fetch', fetchMock);
		const onreported = vi.fn();
		const screen = render(ReportSheet, {
			props: { open: true, targetType: 'post', targetId: 'p-1', onreported }
		});

		await screen.getByRole('radio', { name: 'Harassment or bullying' }).click();
		await screen.getByRole('textbox').fill('  mean replies ');
		await screen.getByRole('button', { name: 'Submit' }).click();

		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(fetchMock).toHaveBeenCalledWith('/api/reports', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				targetType: 'post',
				targetId: 'p-1',
				reason: 'harassment',
				details: 'mean replies'
			})
		});
		expect(onreported).toHaveBeenCalledOnce();
		expect(toast.current?.text).toMatch(/Thanks for reporting/);
	});

	it('shows the server error and stays open', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				Response.json(
					{ error: { code: 'cannot_report_self', message: 'You cannot report yourself' } },
					{ status: 400 }
				)
			)
		);
		const screen = render(ReportSheet, {
			props: { open: true, targetType: 'user', targetId: 'me' }
		});

		await screen.getByRole('radio', { name: 'Spam' }).click();
		await screen.getByRole('button', { name: 'Submit' }).click();

		await expect.element(screen.getByRole('alert')).toHaveTextContent('You cannot report yourself');
		await expect.element(screen.getByRole('dialog')).toBeInTheDocument();
	});
});
