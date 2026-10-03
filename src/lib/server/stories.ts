import { and, desc, eq, gt, lt, sql } from 'drizzle-orm';
import type { Database } from '$lib/server/db';
import { notification, story, storyView, user, userFollow } from '$lib/server/db/schema';
import { notBlockedWith } from '$lib/server/db/blocks';
import { notMutedBy } from '$lib/server/db/mutes';
import { encodeCursor, type FeedCursor } from '$lib/server/db/posts';
import { STORY_TTL_SEC } from '$lib/stories';
import type { StoryReaction } from '$lib/reactions';

export { STORY_TTL_SEC };
export const MAX_STORY_CAPTION = 200;
export const MAX_STORY_LOCATION = 100;
/** Cap on stories in the tray: the newest ones win, and your own always come first. */
export const MAX_TRAY_STORIES = 500;
/** Views of a story are kept this long after it expires, then pruned by the daily cron. */
export const STORY_VIEW_RETENTION_MS = 7 * 24 * 3600 * 1000;

export interface StoredStory {
	id: string;
	userId: string;
	mediaUrl: string;
	mediaType: 'image' | 'video';
	caption: string | null;
	location: string | null;
	/** Viewers other than the author. */
	viewsCount: number;
	createdAt: number;
	expiresAt: number;
}

/** `<userId>:<createdAtMs>`, the id `createStory` gives a story. */
export function parseStoryId(id: string): { userId: string; createdAt: number } | null {
	const match = /^([^:]+):(\d{1,16})$/.exec(id);
	return match ? { userId: match[1], createdAt: Number(match[2]) } : null;
}

const storyFields = {
	id: story.id,
	userId: story.userId,
	mediaUrl: story.mediaUrl,
	mediaType: story.mediaType,
	caption: story.caption,
	location: story.location,
	viewsCount: story.viewsCount,
	createdAt: story.createdAt,
	expiresAt: story.expiresAt
};

type StoryRow = Omit<StoredStory, 'createdAt' | 'expiresAt'> & { createdAt: Date; expiresAt: Date };

const toStored = (row: StoryRow): StoredStory => ({
	...row,
	createdAt: row.createdAt.getTime(),
	expiresAt: row.expiresAt.getTime()
});

const live = (now: number) => gt(story.expiresAt, new Date(now));

/**
 * Shares a story that expires 24 hours from `now`. Null when the author already shared one in
 * the same millisecond, since that is the story's id.
 */
export async function createStory(
	db: Database,
	input: Omit<StoredStory, 'id' | 'viewsCount' | 'createdAt' | 'expiresAt'>,
	now = Date.now()
): Promise<StoredStory | null> {
	const [created] = await db
		.insert(story)
		.values({
			...input,
			id: `${input.userId}:${now}`,
			createdAt: new Date(now),
			expiresAt: new Date(now + STORY_TTL_SEC * 1000)
		})
		.onConflictDoNothing()
		.returning(storyFields);
	return created ? toStored(created) : null;
}

/** The story `id` while it is live. */
export async function getLiveStory(
	db: Database,
	id: string,
	now = Date.now()
): Promise<StoredStory | null> {
	const [row] = await db
		.select(storyFields)
		.from(story)
		.where(and(eq(story.id, id), live(now)))
		.limit(1);
	return row ? toStored(row) : null;
}

export interface TrayStory extends StoredStory {
	author: { id: string; name: string; handle: string | null; image: string | null };
	seen: boolean;
	reaction: StoryReaction | null;
}

/**
 * Live stories by `viewerId` and the people they follow, minus anyone blocked either way or muted,
 * with whether the viewer watched each and the reaction they sent. Own stories first, then newest.
 */
export async function loadTrayStories(
	db: Database,
	viewerId: string,
	now = Date.now()
): Promise<TrayStory[]> {
	const rows = await db
		.select({
			...storyFields,
			author: { id: user.id, name: user.name, handle: user.handle, image: user.image },
			viewedAt: storyView.viewedAt,
			reaction: storyView.reaction
		})
		.from(story)
		.innerJoin(user, eq(user.id, story.userId))
		.leftJoin(storyView, and(eq(storyView.storyId, story.id), eq(storyView.viewerId, viewerId)))
		.where(
			and(
				sql`${story.userId} in (select ${userFollow.followingId} from ${userFollow} where ${userFollow.followerId} = ${viewerId} union all select ${viewerId})`,
				live(now),
				notBlockedWith(viewerId, story.userId),
				notMutedBy(viewerId, story.userId)
			)
		)
		.orderBy(desc(sql`${story.userId} = ${viewerId}`), desc(story.createdAt))
		.limit(MAX_TRAY_STORIES);

	return rows.map(({ viewedAt, reaction, author, ...row }) => ({
		...toStored(row),
		author,
		seen: viewedAt !== null,
		reaction: reaction as StoryReaction | null
	}));
}

/**
 * Statements recording that `viewerId` watched `storyId`, for one `db.batch`: a repeat view keeps
 * the first row, and `changes()` lets only a new row bump `views_count`. The update returns the
 * story id when the view was counted.
 */
export function recordViewStatements(db: Database, storyId: string, viewerId: string) {
	return [
		db.insert(storyView).values({ storyId, viewerId }).onConflictDoNothing(),
		db
			.update(story)
			.set({ viewsCount: sql`${story.viewsCount} + 1` })
			.where(and(eq(story.id, storyId), sql`changes() > 0`))
			.returning({ id: story.id })
	] as const;
}

/** Statement setting (or with `null` clearing) the viewer's reaction on a story they watched. */
export function setReactionStatement(
	db: Database,
	storyId: string,
	viewerId: string,
	reaction: StoryReaction | null
) {
	return db
		.update(storyView)
		.set({ reaction })
		.where(and(eq(storyView.storyId, storyId), eq(storyView.viewerId, viewerId)));
}

export interface StoryViewer {
	id: string;
	name: string;
	handle: string | null;
	image: string | null;
	viewedAt: number;
	reaction: StoryReaction | null;
	isFollowing: boolean;
}

/**
 * One page of who watched `storyId`, most recent first, keyset-paginated on (viewed_at,
 * viewer_id) via `story_view_storyId_viewedAt_idx`. `isFollowing` is whether the author follows
 * the viewer. The cursor is `<viewedAtMs>_<viewerId>`.
 */
export async function loadViewersPage(
	db: Database,
	storyId: string,
	authorId: string,
	{ limit, cursor }: { limit: number; cursor: FeedCursor | null }
): Promise<{ viewers: StoryViewer[]; nextCursor: string | null }> {
	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			handle: user.handle,
			image: user.image,
			viewedAt: storyView.viewedAt,
			reaction: storyView.reaction,
			followedAt: userFollow.createdAt
		})
		.from(storyView)
		.innerJoin(user, eq(user.id, storyView.viewerId))
		.leftJoin(
			userFollow,
			and(eq(userFollow.followerId, authorId), eq(userFollow.followingId, storyView.viewerId))
		)
		.where(
			and(
				eq(storyView.storyId, storyId),
				notBlockedWith(authorId, storyView.viewerId),
				cursor
					? sql`(${storyView.viewedAt}, ${storyView.viewerId}) < (${cursor.createdAt}, ${cursor.id})`
					: undefined
			)
		)
		.orderBy(desc(storyView.viewedAt), desc(storyView.viewerId))
		.limit(limit + 1);

	const page = rows.slice(0, limit);
	const last = page.at(-1);
	return {
		viewers: page.map(({ followedAt, viewedAt, reaction, ...person }) => ({
			...person,
			viewedAt: viewedAt.getTime(),
			reaction: reaction as StoryReaction | null,
			isFollowing: followedAt !== null
		})),
		nextCursor:
			rows.length > limit && last ? encodeCursor({ createdAt: last.viewedAt, id: last.id }) : null
	};
}

/**
 * Deletes one of `authorId`'s stories with its views (by cascade) and the reaction notifications
 * about it. Returns its media URL, or null when there was no such story.
 */
export async function deleteStory(
	db: Database,
	id: string,
	authorId: string
): Promise<string | null> {
	const [deleted] = await db.batch([
		db
			.delete(story)
			.where(and(eq(story.id, id), eq(story.userId, authorId)))
			.returning({ mediaUrl: story.mediaUrl }),
		// Reaction notifications are keyed `story_reaction:<actor>:<storyId>` (see `dedupeKey`).
		db
			.delete(notification)
			.where(
				and(
					eq(notification.recipientId, authorId),
					eq(notification.type, 'story_reaction'),
					sql`${notification.dedupeKey} = 'story_reaction:' || ${notification.actorId} || ':' || ${id}`
				)
			)
	]);
	return deleted[0]?.mediaUrl ?? null;
}

/**
 * Deletes the views of stories that expired more than `STORY_VIEW_RETENTION_MS` ago. The story rows
 * stay: they record the R2 media that account deletion removes.
 */
export async function pruneStoryViews(db: Database, now = Date.now()): Promise<number> {
	const result = await db
		.delete(storyView)
		.where(
			sql`${storyView.storyId} in (select ${story.id} from ${story} where ${lt(story.expiresAt, new Date(now - STORY_VIEW_RETENTION_MS))})`
		);
	return result.meta.changes;
}
