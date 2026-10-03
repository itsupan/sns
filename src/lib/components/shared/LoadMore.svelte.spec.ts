import { render } from 'vitest-browser-svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubIntersectionObserver } from '../../../test/intersection-observer';
import LoadMore from './LoadMore.svelte';

beforeEach(stubIntersectionObserver);
afterEach(() => vi.unstubAllGlobals());

describe('LoadMore', () => {
	it('loads when its sentinel comes into view', async () => {
		const onLoad = vi.fn();
		render(LoadMore, { onLoad, loading: false, error: null });
		await vi.waitFor(() => expect(onLoad).toHaveBeenCalledOnce());
	});

	it('says it is loading and does not ask again meanwhile', async () => {
		const onLoad = vi.fn();
		const screen = render(LoadMore, { onLoad, loading: true, error: null });
		await expect.element(screen.getByText('Loading…')).toBeVisible();
		await new Promise((r) => setTimeout(r, 50));
		expect(onLoad).not.toHaveBeenCalled();
	});

	it('shows a failed page with a retry instead of loading again by itself', async () => {
		const onLoad = vi.fn();
		const screen = render(LoadMore, { onLoad, loading: false, error: 'Could not load more' });
		await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not load more');
		await new Promise((r) => setTimeout(r, 50));
		expect(onLoad).not.toHaveBeenCalled();

		await screen.getByRole('button', { name: 'Try again' }).click();
		expect(onLoad).toHaveBeenCalledOnce();
	});
});
