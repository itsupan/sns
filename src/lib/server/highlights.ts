import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '$lib/server/db';
import { story, storyHighlight, storyHighlightItem } from '$lib/server/db/schema';
import { visibleTo } from '$lib/server/db/visibility';
import { ApiError } from '$lib/server/api';
import { getOwnStory, inAudience, savedStoryFields, toStored } from '$lib/server/stories';
import {
	MAX_HIGHLIGHT_ITEMS,
	MAX_HIGHLIGHTS_PER_USER,
	type HighlightData,
	type SavedStory
} from '$lib/highlights';

type HighlightRow = typeof storyHighlight.$inferSelect;

/** Loads one of the user's highlights; 404 for anyone else's, so ids cannot be probed. */
export async function requireOwnHighlight(
	db: Database,
	userId: string,
	highlightId: string
): Promise<HighlightRow> {
	const [row] = await db
		.select()
		.from(storyHighlight)
		.where(and(eq(storyHighlight.id, highlightId), eq(storyHighlight.userId, userId)))
		.limit(1);
	if (!row) throw new ApiError(404, 'not_found', 'Highlight not found');
	return row;
}

/** One of the user's own stories, live or expired; 404 otherwise. */
async function requireOwnStory(db: Database, userId: string, storyId: string): Promise<void> {
	if (!(await getOwnStory(db, storyId, userId))) {
		throw new ApiError(404, 'not_found', 'Story not found');
	}
}

/**
 * `ownerId`'s highlights, newest first, each with the stories `viewerId` may see in playing order.
 * Like the profile's posts, none when a block either way or a private account the viewer doesn't
 * follow hides the owner; close friends stories only reach the owner's list. Highlights left with
 * nothing to play are dropped, except for the owner, who still manages them.
 */
export async function loadHighlights(
	db: Database,
	ownerId: string,
	viewerId: string | null | undefined
): Promise<HighlightData[]> {
	const visibleOwner = and(
		eq(storyHighlight.userId, ownerId),
		visibleTo(viewerId, storyHighlight.userId)
	);
	const [highlights, items] = await Promise.all([
		db
			.select()
			.from(storyHighlight)
			.where(visibleOwner)
			.orderBy(desc(storyHighlight.createdAt), desc(storyHighlight.id)),
		db
			.select({ highlightId: storyHighlightItem.highlightId, story: savedStoryFields })
			.from(storyHighlightItem)
			.innerJoin(storyHighlight, eq(storyHighlight.id, storyHighlightItem.highlightId))
			.innerJoin(story, eq(story.id, storyHighlightItem.storyId))
			.where(and(visibleOwner, inAudience(viewerId)))
			.orderBy(asc(storyHighlightItem.position), asc(story.createdAt))
	]);

	const stories = new Map<string, SavedStory[]>();
	for (const item of items) {
		const list = stories.get(item.highlightId) ?? [];
		list.push(toStored(item.story));
		stories.set(item.highlightId, list);
	}
	return highlights
		.map((h) => ({
			id: h.id,
			title: h.title,
			coverStoryId: h.coverStoryId,
			stories: stories.get(h.id) ?? [],
			createdAt: h.createdAt.getTime(),
			updatedAt: h.updatedAt.getTime()
		}))
		.filter((h) => h.stories.length > 0 || viewerId === ownerId);
}

/**
 * Starts a highlight holding one of the user's stories. The cap is checked by the insert itself,
 * so concurrent creates cannot pass `MAX_HIGHLIGHTS_PER_USER`; a 400 when full.
 */
export async function createHighlight(
	db: Database,
	userId: string,
	title: string,
	storyId: string
): Promise<{ id: string; title: string }> {
	await requireOwnStory(db, userId, storyId);
	const id = crypto.randomUUID();
	const now = Date.now();
	const [inserted] = await db.batch([
		db.all(
			sql`insert into ${storyHighlight} (id, user_id, title, created_at, updated_at) select ${id}, ${userId}, ${title}, ${now}, ${now} where (select count(*) from ${storyHighlight} where user_id = ${userId}) < ${MAX_HIGHLIGHTS_PER_USER} returning id`
		),
		db.run(
			sql`insert into ${storyHighlightItem} (highlight_id, story_id, position) select ${id}, ${storyId}, 0 where changes() > 0`
		)
	]);
	if (inserted.length === 0) {
		throw new ApiError(
			400,
			'validation_failed',
			`You can keep at most ${MAX_HIGHLIGHTS_PER_USER} highlights`
		);
	}
	return { id, title };
}

/**
 * Adds one of the user's stories (live or expired) at the end of their highlight. Idempotent; the
 * cap is checked by the insert itself, a 400 when the highlight already holds
 * `MAX_HIGHLIGHT_ITEMS`.
 */
export async function addHighlightItem(
	db: Database,
	userId: string,
	highlightId: string,
	storyId: string
): Promise<void> {
	await Promise.all([
		requireOwnHighlight(db, userId, highlightId),
		requireOwnStory(db, userId, storyId)
	]);
	const [inserted] = await db.batch([
		db.all(
			sql`insert into ${storyHighlightItem} (highlight_id, story_id, position) select ${highlightId}, ${storyId}, coalesce(max(position) + 1, 0) from ${storyHighlightItem} where highlight_id = ${highlightId} having count(*) < ${MAX_HIGHLIGHT_ITEMS} on conflict do nothing returning story_id`
		),
		db
			.update(storyHighlight)
			.set({ updatedAt: new Date() })
			.where(and(eq(storyHighlight.id, highlightId), sql`changes() > 0`))
	]);
	if (inserted.length > 0) return;

	const [present] = await db
		.select({ storyId: storyHighlightItem.storyId })
		.from(storyHighlightItem)
		.where(
			and(eq(storyHighlightItem.highlightId, highlightId), eq(storyHighlightItem.storyId, storyId))
		)
		.limit(1);
	if (!present) {
		throw new ApiError(
			400,
			'validation_failed',
			`A highlight can hold at most ${MAX_HIGHLIGHT_ITEMS} stories`
		);
	}
}

/** Takes a story out of the user's highlight, and off its cover. Idempotent. */
export async function removeHighlightItem(
	db: Database,
	userId: string,
	highlightId: string,
	storyId: string
): Promise<void> {
	await requireOwnHighlight(db, userId, highlightId);
	await db.batch([
		db
			.delete(storyHighlightItem)
			.where(
				and(
					eq(storyHighlightItem.highlightId, highlightId),
					eq(storyHighlightItem.storyId, storyId)
				)
			),
		db
			.update(storyHighlight)
			.set({
				coverStoryId: sql`nullif(${storyHighlight.coverStoryId}, ${storyId})`,
				updatedAt: new Date()
			})
			.where(and(eq(storyHighlight.id, highlightId), sql`changes() > 0`))
	]);
}

export interface HighlightChanges {
	title?: string;
	/** One of the highlight's stories, or null for its first. */
	coverStoryId?: string | null;
	/** The stories to keep, in their new order: a subset of the current ones. */
	storyIds?: string[];
}

/**
 * Renames the user's highlight, picks its cover, and reorders or drops its stories, in one batch.
 * A cover dropped with its story falls back to the first one.
 */
export async function updateHighlight(
	db: Database,
	userId: string,
	highlightId: string,
	changes: HighlightChanges
): Promise<void> {
	const [highlight, items] = await Promise.all([
		requireOwnHighlight(db, userId, highlightId),
		db
			.select({ storyId: storyHighlightItem.storyId })
			.from(storyHighlightItem)
			.where(eq(storyHighlightItem.highlightId, highlightId))
	]);
	const current = new Set(items.map((i) => i.storyId));
	const kept = changes.storyIds ?? [...current];
	if (changes.storyIds && kept.some((id) => !current.has(id))) {
		throw new ApiError(400, 'validation_failed', 'Only stories in the highlight can be reordered');
	}
	const cover = changes.coverStoryId === undefined ? highlight.coverStoryId : changes.coverStoryId;
	if (changes.coverStoryId && !current.has(changes.coverStoryId)) {
		throw new ApiError(400, 'validation_failed', 'The cover must be a story in the highlight');
	}

	const keep = new Set(kept);
	const dropped = [...current].filter((id) => !keep.has(id));
	const item = (storyId: string) =>
		and(eq(storyHighlightItem.highlightId, highlightId), eq(storyHighlightItem.storyId, storyId));
	await db.batch([
		db
			.update(storyHighlight)
			.set({
				title: changes.title,
				coverStoryId: cover && keep.has(cover) ? cover : null,
				updatedAt: new Date()
			})
			.where(eq(storyHighlight.id, highlightId)),
		...dropped.map((storyId) => db.delete(storyHighlightItem).where(item(storyId))),
		...(changes.storyIds ?? []).map((storyId, position) =>
			db.update(storyHighlightItem).set({ position }).where(item(storyId))
		)
	]);
}

/** Deletes the user's highlight; its stories stay in the archive. Idempotent. */
export async function deleteHighlight(
	db: Database,
	userId: string,
	highlightId: string
): Promise<void> {
	await db
		.delete(storyHighlight)
		.where(and(eq(storyHighlight.id, highlightId), eq(storyHighlight.userId, userId)));
}
