import { createAuthClient } from 'better-auth/svelte';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import type { auth } from '../../better-auth.config';

export const authClient = createAuthClient({
	plugins: [inferAdditionalFields<typeof auth>()]
});
