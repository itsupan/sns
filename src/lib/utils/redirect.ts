/**
 * `target` as a path on `origin` (with its query and hash), or `fallback` when it is missing or
 * points anywhere else, so a `redirectTo` parameter can never send someone off-site.
 */
export function sameOriginPath(
	target: string | null | undefined,
	origin: string,
	fallback = '/'
): string {
	if (!target) return fallback;
	try {
		const url = new URL(target, origin);
		return url.origin === origin ? url.pathname + url.search + url.hash : fallback;
	} catch {
		return fallback;
	}
}
