import { and, inArray, ne } from 'drizzle-orm';
import type { Database } from '.';
import { user } from './schema';
import { handleFromName } from '$lib/utils/handle';

const SUGGESTION_ATTEMPTS = 5;

/** Which of `handles` (a handful) belong to someone other than `userId`. */
async function takenHandles(db: Database, handles: string[], userId: string): Promise<Set<string>> {
	const rows = await db
		.select({ handle: user.handle })
		.from(user)
		.where(and(inArray(user.handle, handles), ne(user.id, userId)))
		.limit(handles.length);
	return new Set(rows.flatMap((row) => row.handle ?? []));
}

/** Whether `handle` belongs to someone other than `userId`. */
export async function isHandleTaken(
	db: Database,
	handle: string,
	userId: string
): Promise<boolean> {
	return (await takenHandles(db, [handle], userId)).size > 0;
}

/**
 * A free handle for `userId` from their name: the name itself, else the name with four random
 * digits. Names without Latin letters or digits start from `user`.
 */
export async function suggestHandle(db: Database, name: string, userId: string): Promise<string> {
	const base = handleFromName(name) || 'user';
	const stem = base.slice(0, 26).replace(/\.+$/, '');
	const candidates = [
		base,
		...Array.from(
			{ length: SUGGESTION_ATTEMPTS },
			() => `${stem}${1000 + Math.floor(Math.random() * 9000)}`
		)
	];
	const taken = await takenHandles(db, candidates, userId);
	return candidates.find((handle) => !taken.has(handle)) ?? base;
}
