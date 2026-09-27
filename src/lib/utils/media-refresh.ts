const inFlightRefreshes = new Map<string, Promise<string>>();

/**
 * Proactively or reactively refreshes an expired Cloudflare R2 presigned URL.
 * Automatically deduplicates parallel requests for the same media URL.
 *
 * @param url The media URL that may have expired or failed to load
 * @returns The refreshed, working media URL, or the original URL on failure
 */
export async function refreshExpiredMediaUrl(url: string | undefined | null): Promise<string> {
	if (!url || typeof url !== 'string') return '';

	// Skip inline data URLs or blob URLs
	if (url.startsWith('data:') || url.startsWith('blob:')) {
		return url;
	}

	// If already in flight, reuse the promise
	if (inFlightRefreshes.has(url)) {
		return inFlightRefreshes.get(url)!;
	}

	const promise = (async () => {
		try {
			const res = await fetch('/api/media/refresh', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ urls: [url] })
			});

			if (res.ok) {
				const data = (await res.json()) as { refreshed?: Record<string, string> };
				const fresh = data.refreshed?.[url];
				if (fresh && typeof fresh === 'string' && fresh !== url) {
					return fresh;
				}
			}
		} catch (err) {
			console.warn('[media-refresh] Error refreshing media URL:', err);
		} finally {
			// Clear from cache after a short delay so subsequent refreshes can occur if needed
			setTimeout(() => {
				inFlightRefreshes.delete(url);
			}, 5000);
		}

		return url;
	})();

	inFlightRefreshes.set(url, promise);
	return promise;
}
