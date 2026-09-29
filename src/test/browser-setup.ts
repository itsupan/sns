/*
 * Browser (client project) test setup.
 *
 * Components under test sometimes make same-origin requests that the test did not mock, e.g.
 * Better Auth's `useSession()` fetching `/api/auth/get-session`. Those would reach the Vitest
 * dev server, where SvelteKit's SSR middleware cannot boot (and logs a `wrapDynamicImport`
 * TypeError). Answer them here instead with a deterministic 404, which every caller treats as
 * "no data" (Better Auth: signed out). Tests that need a response stub `fetch` themselves;
 * `vi.unstubAllGlobals()` restores this wrapper because it is assigned, not stubbed.
 */
const realFetch = globalThis.fetch.bind(globalThis);

/** Vite's own module, dependency and asset requests must keep working. */
const VITE_PATHS = /^\/(@|node_modules\/|src\/|\.svelte-kit\/|__vitest|favicon)/;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
	const url = new URL(input instanceof Request ? input.url : String(input), location.href);
	if (url.origin !== location.origin || VITE_PATHS.test(url.pathname)) {
		return realFetch(input, init);
	}
	return new Response(
		JSON.stringify({ error: { code: 'not_mocked', message: `No mock for ${url.pathname}` } }),
		{ status: 404, headers: { 'content-type': 'application/json' } }
	);
};
