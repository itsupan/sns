import type { LayoutServerLoad } from './$types';
import { getConfig } from '$lib/server/config';

/** Deployment flags that components read from `page.data`; config only, no per-request work. */
export const load: LayoutServerLoad = ({ platform }) => {
	const { imageTransforms, turnstileSiteKey } = getConfig(platform?.env);
	return { imageTransforms, turnstileSiteKey };
};
