import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '.';
import { closeFriend, user } from './schema';

const pair = (userId: string, friendId: string) =>
	and(eq(closeFriend.userId, userId), eq(closeFriend.friendId, friendId));

/** Whether `friendId` is on `userId`'s close friends list. */
export async function isCloseFriend(db: Database, userId: string, friendId: string) {
	const rows = await db
		.select({ friendId: closeFriend.friendId })
		.from(closeFriend)
		.where(pair(userId, friendId))
		.limit(1);
	return rows.length > 0;
}

/** Adds or removes `friendId` on `userId`'s list. Idempotent: repeating either changes nothing. */
export async function setCloseFriend(
	db: Database,
	userId: string,
	friendId: string,
	add: boolean
): Promise<void> {
	if (add) await db.insert(closeFriend).values({ userId, friendId }).onConflictDoNothing();
	else await db.delete(closeFriend).where(pair(userId, friendId));
}

export interface CloseFriend {
	id: string;
	name: string;
	handle: string | null;
	image: string | null;
	addedAt: number;
}

/** `userId`'s close friends, most recently added first. */
export async function listCloseFriends(db: Database, userId: string): Promise<CloseFriend[]> {
	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			handle: user.handle,
			image: user.image,
			createdAt: closeFriend.createdAt
		})
		.from(closeFriend)
		.innerJoin(user, eq(user.id, closeFriend.friendId))
		.where(eq(closeFriend.userId, userId))
		.orderBy(desc(closeFriend.createdAt), desc(user.id));
	return rows.map(({ createdAt, ...u }) => ({ ...u, addedAt: createdAt.getTime() }));
}
