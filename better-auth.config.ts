import { betterAuth } from 'better-auth';
import { authOptions } from './src/lib/server/auth-options';

/**
 * Only read by the Better Auth CLI (`pnpm auth:schema`), which needs a statically
 * exported instance. The real, per-request instance lives in src/lib/server/auth.ts.
 */
export const auth = betterAuth(authOptions({} as Env));
