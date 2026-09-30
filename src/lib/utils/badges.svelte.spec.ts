import { afterEach, describe, expect, it, vi } from 'vitest';
import { badges } from './badges.svelte';

afterEach(() => {
	vi.unstubAllGlobals();
	badges.clear();
});

describe('badges', () => {
	it('shares one request between concurrent refreshes', async () => {
		const fetchMock = vi.fn(async () => Response.json({ messages: 2, activity: 5 }));
		vi.stubGlobal('fetch', fetchMock);
		await Promise.all([badges.refresh(), badges.refresh()]);
		expect(fetchMock).toHaveBeenCalledOnce();
		expect([badges.messages, badges.activity]).toEqual([2, 5]);
	});

	it('ignores a response that arrives after sign-out', async () => {
		let release!: () => void;
		const gate = new Promise<void>((r) => (release = r));
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				await gate;
				return Response.json({ messages: 3, activity: 4 });
			})
		);
		const pending = badges.refresh();
		badges.clear();
		release();
		await pending;
		expect([badges.messages, badges.activity]).toEqual([0, 0]);
	});

	it('keeps the last counts when the request fails', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Response.json({ messages: 1, activity: 1 }))
		);
		await badges.refresh();
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('', { status: 500 }))
		);
		await badges.refresh();
		expect([badges.messages, badges.activity]).toEqual([1, 1]);
	});
});
