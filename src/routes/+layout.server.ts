import type { LayoutServerLoad } from './$types';
import { building } from '$app/environment';
import { getConfig } from '$lib/server/config';

/**
 * Deployment flags that components read from `page.data`; config only, no per-request work.
 * Prerendered pages cannot read the env, so they get the defaults.
 */
export const load: LayoutServerLoad = ({ platform }) => {
	const { imageTransforms, turnstileSiteKey, webPush } = getConfig(
		building ? undefined : platform?.env
	);
	return { imageTransforms, turnstileSiteKey, pushPublicKey: webPush?.publicKey ?? null };
};
