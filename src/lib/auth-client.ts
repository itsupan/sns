import { createAuthClient } from 'better-auth/svelte';
import { inferAdditionalFields, twoFactorClient } from 'better-auth/client/plugins';
import type { auth } from '../../better-auth.config';

export const authClient = createAuthClient({
	plugins: [inferAdditionalFields<typeof auth>(), twoFactorClient()]
});
