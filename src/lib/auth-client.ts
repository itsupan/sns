import { createAuthClient } from 'better-auth/svelte';

/** Browser-side Better Auth client, e.g. `authClient.signIn.social({ provider: 'google' })`. */
export const authClient = createAuthClient();
