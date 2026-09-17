/**
 * Drizzle table definitions — the source of truth for the database.
 * App tables go in this file. Better Auth's tables live in `auth-schema.ts`, which is
 * generated — run `pnpm auth:schema` after changing `auth-options.ts` instead of editing it.
 *
 * Workflow after editing either file:
 *   pnpm db:generate --name <what_changed>   # drizzle-kit writes migrations/NNNN_*.sql
 *   pnpm db:setup:local                      # apply it to the local D1 in .wrangler/state
 */
export * from './auth-schema';
