import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SearchBox, { SEARCH_DEBOUNCE_MS } from './SearchBox.svelte';

const goto = vi.hoisted(() => vi.fn());
vi.mock('$app/navigation', () => ({ goto }));

const kai = {
	id: 'u-kai',
	name: 'Kai Takahashi',
	handle: '@kai.raw',
	slug: 'kai.raw',
	image: null,
	bio: null,
	followersCount: 3
};
const post = {
	id: 'p-1',
	snippet: 'Wood-fired kai ceramics',
	location: 'Kyoto',
	thumbnail: null,
	author: { id: 'u-kai', name: 'Kai Takahashi', handle: '@kai.raw', image: null }
};

let requests: Array<{ q: string; signal: AbortSignal }>;
let respond: (q: string) => { status?: number; body: unknown };

beforeEach(() => {
	requests = [];
	respond = () => ({ body: { users: [kai], posts: [post] } });
	goto.mockReset();
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = new URL(String(input), 'http://localhost');
			const q = url.searchParams.get('q') ?? '';
			requests.push({ q, signal: init!.signal! });
			const { status = 200, body } = respond(q);
			return new Response(JSON.stringify(body), { status });
		})
	);
});

afterEach(() => vi.unstubAllGlobals());

describe('SearchBox', () => {
	it('waits for the debounce and sends one request for a burst of typing', async () => {
		const screen = render(SearchBox);
		const input = screen.getByRole('combobox', { name: 'Search creators and posts' });
		await userEvent.type(input, 'kai');

		expect(requests).toHaveLength(0);
		await expect
			.element(screen.getByRole('option', { name: /Kai Takahashi/ }).first())
			.toBeVisible();
		expect(requests.map((r) => r.q)).toEqual(['kai']);
	});

	it('aborts the stale request when the query changes', async () => {
		let release!: () => void;
		const gate = new Promise<void>((r) => (release = r));
		respond = (q) => ({
			body: q === 'kai' ? { users: [kai], posts: [] } : { users: [], posts: [post] }
		});
		const slowFetch = globalThis.fetch;
		let staleSignal: AbortSignal | undefined;
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				if (new URL(String(input), 'http://localhost').searchParams.get('q') === 'kai') {
					// Resolves even after abort, like a response already in flight.
					staleSignal = init?.signal ?? undefined;
					await gate;
				}
				return slowFetch(input, init);
			})
		);
		const screen = render(SearchBox);
		const input = screen.getByRole('combobox');

		await input.fill('kai');
		await new Promise((r) => setTimeout(r, SEARCH_DEBOUNCE_MS + 50));
		await input.fill('kai cer');
		await expect.element(screen.getByText('Posts')).toBeVisible();
		release();

		expect(staleSignal?.aborted).toBe(true);
		// The slow "kai" response never replaces the newer results.
		await new Promise((r) => setTimeout(r, 50));
		await expect.element(screen.getByText('Users')).not.toBeInTheDocument();
	});

	it('explains the minimum length and does not search short input', async () => {
		const screen = render(SearchBox);
		await screen.getByRole('combobox').fill('ka');
		await expect.element(screen.getByText('Type at least 3 characters to search.')).toBeVisible();
		await new Promise((r) => setTimeout(r, SEARCH_DEBOUNCE_MS + 50));
		expect(requests).toHaveLength(0);
	});

	it('navigates results with the keyboard and opens the active one', async () => {
		const screen = render(SearchBox);
		const input = screen.getByRole('combobox');
		await input.fill('kai');
		await expect.element(screen.getByRole('option').first()).toBeVisible();

		await userEvent.keyboard('{ArrowDown}');
		const [userOption, postOption] = screen.getByRole('option').elements();
		await expect.element(input).toHaveAttribute('aria-activedescendant', userOption.id);
		await userEvent.keyboard('{ArrowDown}');
		await expect.element(input).toHaveAttribute('aria-activedescendant', postOption.id);
		// Wraps around.
		await userEvent.keyboard('{ArrowDown}');
		await expect.element(input).toHaveAttribute('aria-activedescendant', userOption.id);

		await userEvent.keyboard('{ArrowUp}{Enter}');
		expect(goto).toHaveBeenCalledWith('/post/p-1');
	});

	it('closes on Escape and highlights the matched text', async () => {
		const screen = render(SearchBox);
		const input = screen.getByRole('combobox');
		await input.fill('ceramic');
		await expect.element(screen.getByText('ceramic', { exact: true })).toBeVisible();
		expect(screen.getByText('ceramic', { exact: true }).element().tagName).toBe('MARK');

		await userEvent.keyboard('{Escape}');
		await expect.element(input).toHaveAttribute('aria-expanded', 'false');
	});

	it('shows empty and error states', async () => {
		respond = () => ({ body: { users: [], posts: [] } });
		const screen = render(SearchBox);
		const input = screen.getByRole('combobox');
		await input.fill('zzzz');
		await expect.element(screen.getByText('No results for “zzzz”.')).toBeVisible();

		respond = () => ({
			status: 429,
			body: { error: { code: 'rate_limited', message: 'Slow down' } }
		});
		await input.fill('yyyy');
		await expect.element(screen.getByText('Slow down')).toBeVisible();
	});
});
