import * as v from 'valibot';
import { and, eq } from 'drizzle-orm';
import { verifyPassword } from 'better-auth/crypto';
import type { RequestHandler } from './$types';
import { account } from '$lib/server/db/auth-schema';
import { deleteAccount } from '$lib/server/db/account';
import { ApiError, enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';

const DeleteAccountBody = v.object({
	confirm: v.literal('DELETE', 'Type DELETE to confirm'),
	password: v.optional(v.pipe(v.string(), v.maxLength(1024)))
});

/**
 * Deletes the signed-in account and everything it owns. Needs `confirm: "DELETE"`, plus the
 * current password when the account has one (Google-only accounts have none). Sessions cascade
 * away with the user, so the session cookie stops working immediately.
 */
export const DELETE: RequestHandler = withApi(async ({ locals, platform, request }) => {
	const me = requireUser(locals);
	await enforceRateLimit(platform, 'accountDelete', me.id);
	const body = await parseBody(request, DeleteAccountBody);

	const [credential] = await locals.db
		.select({ hash: account.password })
		.from(account)
		.where(and(eq(account.userId, me.id), eq(account.providerId, 'credential')));
	if (credential?.hash) {
		const ok =
			!!body.password && (await verifyPassword({ hash: credential.hash, password: body.password }));
		if (!ok) throw new ApiError(403, 'invalid_password', 'Incorrect password');
	}

	const result = await deleteAccount(locals.db, platform?.env, me.id);
	if (!result) throw new ApiError(404, 'not_found', 'Account not found');

	return new Response(null, { status: 204 });
});
