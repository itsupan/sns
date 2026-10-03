import { page } from '$app/state';

/** Widths for an image shown at most about 672px wide: the feed, a post page. */
export const FEED_IMAGE_WIDTHS = [480, 720, 1080, 1440] as const;
/** Widths for a cell of a three-column grid: Explore, tags, a profile. */
export const GRID_IMAGE_WIDTHS = [256, 384, 512, 768] as const;

const QUALITY = 85;

/**
 * A `srcset` of resized copies of `url` from Cloudflare Image Transformations, when the
 * `IMAGE_TRANSFORMS` var is on. Only our own media (`/api/media/...`) is offered: the service
 * fetches the source from this zone, and external images keep their own URL. Read during
 * rendering, since the flag arrives with the root layout's data.
 */
export function imageSrcset(url: string, widths: readonly number[]): string | undefined {
	if (!page.data.imageTransforms || !url.startsWith('/api/media/')) return undefined;
	return widths
		.map((width) => `/cdn-cgi/image/width=${width},quality=${QUALITY},format=auto${url} ${width}w`)
		.join(', ');
}
