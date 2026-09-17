import { betterAuth } from 'better-auth';
import { authOptions } from './src/lib/server/auth-options';

export const auth = betterAuth(authOptions({} as Env));
