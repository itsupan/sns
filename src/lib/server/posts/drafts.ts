import { and, asc, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import type { Database } from '$lib/server/db';
import { postDraft, postMedia, user } from '$lib/server/db/schema';
import type { PostData } from '$lib/components/feed/PostCard.svelte';
import { ApiError } from '$lib/server/api';
import { extractR2Key, ownedMediaKeys } from '$lib/server/services/storage';
import {
	MAX_DRAFTS_PER_USER,
	MAX_SCHEDULE_LEAD_MS,
	MIN_SCHEDULE_LEAD_MS,
	type DraftData,
	type DraftPayload
} from '$lib/drafts';
import { createPost, validatePostInput } from './create';

/** Due drafts one cron run publishes; any others wait for the next minute. */
const PUBLISH_BATCH = 50;

type DraftRow = typeof postDraft.$inferSelect;

export function toDraftData(row: DraftRow): DraftData {
	return {
		id: row.id,
		payload: JSON.parse(row.payload) as DraftPayload,
		publishAt: row.publishAt?.toISOString() ?? null,
		lastError: row.lastError,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString()
	};
}

/** Checks a composer payload with the `createPost` rules; returns it as a draft stores it. */
export function draftPayload(
	platform: App.Platform | undefined,
	userId: string,
	input: Record<string, unknown>
): string {
	const post = validatePostInput(platform, userId, input);
	const payload: DraftPayload = {
		content: post.content,
		title: post.title,
		mediaUrls: post.mediaItems,
		aspectRatio: post.aspectRatio,
		location: post.location,
		cameraMeta: post.cameraMeta,
		postType: post.postType,
		background: post.background,
		poll: post.poll,
		tags: post.tags.map((t) => t.name)
	};
	return JSON.stringify(payload);
}

/** The publish time an ISO string asks for; a 400 unless it is within the schedule window. */
export function publishTime(iso: string, now = Date.now()): Date {
	const at = new Date(iso);
	if (at.getTime() < now + MIN_SCHEDULE_LEAD_MS || at.getTime() > now + MAX_SCHEDULE_LEAD_MS) {
		const message = 'Schedule the post between 5 minutes and 30 days from now';
		throw new ApiError(400, 'validation_failed', message, { publishAt: message });
	}
	return at;
}

export function draftMediaUrls(payload: string): string[] {
	return (JSON.parse(payload) as DraftPayload).mediaUrls.map((m) => m.url);
}

/** The user's drafts, last edited first. There are at most `MAX_DRAFTS_PER_USER`. */
export async function listDrafts(db: Database, userId: string): Promise<DraftData[]> {
	const rows = await db
		.select()
		.from(postDraft)
		.where(eq(postDraft.userId, userId))
		.orderBy(desc(postDraft.updatedAt));
	return rows.map(toDraftData);
}

/** Loads one of the user's drafts; 404 for anyone else's, so ids cannot be probed. */
export async function requireOwnDraft(
	db: Database,
	userId: string,
	draftId: string
): Promise<DraftRow> {
	const [row] = await db
		.select()
		.from(postDraft)
		.where(and(eq(postDraft.id, draftId), eq(postDraft.userId, userId)))
		.limit(1);
	if (!row) throw new ApiError(404, 'not_found', 'Draft not found');
	return row;
}

/**
 * Saves a new draft. The cap is checked by the insert itself, so concurrent saves cannot pass
 * `MAX_DRAFTS_PER_USER`; a 400 when full.
 */
export async function createDraft(
	db: Database,
	userId: string,
	payload: string,
	publishAt: Date | null
): Promise<DraftData> {
	const id = crypto.randomUUID();
	const now = new Date();
	const inserted = await db.all(
		sql`insert into ${postDraft} (id, user_id, payload, publish_at, created_at, updated_at) select ${id}, ${userId}, ${payload}, ${publishAt?.getTime() ?? null}, ${now.getTime()}, ${now.getTime()} where (select count(*) from ${postDraft} where user_id = ${userId}) < ${MAX_DRAFTS_PER_USER} returning id`
	);
	if (inserted.length === 0) {
		throw new ApiError(
			400,
			'validation_failed',
			`You can keep at most ${MAX_DRAFTS_PER_USER} drafts`
		);
	}
	return toDraftData({
		id,
		userId,
		payload,
		publishAt,
		lastError: null,
		createdAt: now,
		updatedAt: now
	});
}

/** Changes a draft's post or schedule; `undefined` leaves a field as is. Clears the last error. */
export async function updateDraft(
	db: Database,
	userId: string,
	draftId: string,
	changes: { payload?: string; publishAt?: Date | null }
): Promise<DraftData> {
	const [row] = await db
		.update(postDraft)
		.set({ ...changes, lastError: null, updatedAt: new Date() })
		.where(and(eq(postDraft.id, draftId), eq(postDraft.userId, userId)))
		.returning();
	if (!row) throw new ApiError(404, 'not_found', 'Draft not found');
	return toDraftData(row);
}

/**
 * Deletes a draft. Returns the storage keys of its uploads that no post uses, for the caller to
 * remove: a post published from the draft keeps its media.
 */
export async function deleteDraft(
	db: Database,
	userId: string,
	draftId: string
): Promise<string[]> {
	const [row] = await db
		.delete(postDraft)
		.where(and(eq(postDraft.id, draftId), eq(postDraft.userId, userId)))
		.returning({ payload: postDraft.payload });
	if (!row) throw new ApiError(404, 'not_found', 'Draft not found');

	const urls = draftMediaUrls(row.payload);
	if (urls.length === 0) return [];
	const used = await db
		.selectDistinct({ url: postMedia.url })
		.from(postMedia)
		.where(inArray(postMedia.url, urls));
	const usedKeys = new Set(used.map((m) => extractR2Key(m.url)));
	return ownedMediaKeys(urls, userId).filter((key) => !usedKeys.has(key));
}

/**
 * Posts a draft through `createPost`, so its mentions notify now, then deletes it. The draft is
 * claimed first (unscheduled, `updated_at` bumped), so a cron run and "Publish now" cannot both
 * post it; returns null when it changed since it was read.
 */
export async function publishDraft(
	db: Database,
	platform: App.Platform | undefined,
	draft: DraftRow
): Promise<PostData | null> {
	const [claimed] = await db
		.update(postDraft)
		.set({ publishAt: null, updatedAt: new Date() })
		.where(and(eq(postDraft.id, draft.id), eq(postDraft.updatedAt, draft.updatedAt)))
		.returning({ id: postDraft.id });
	if (!claimed) return null;

	const post = await createPost(db, platform, draft.userId, JSON.parse(draft.payload));
	await db.delete(postDraft).where(eq(postDraft.id, draft.id));
	return post;
}

/**
 * Publishes the drafts whose time has come, earliest first. One that cannot be posted (its
 * media is gone, its author is suspended...) is kept unscheduled, with the reason in `last_error`.
 */
export async function publishDueDrafts(
	db: Database,
	platform: App.Platform | undefined,
	now = new Date()
): Promise<{ published: number; failed: number }> {
	const due = await db
		.select({ draft: postDraft, banned: user.banned, banExpires: user.banExpires })
		.from(postDraft)
		.innerJoin(user, eq(user.id, postDraft.userId))
		.where(lte(postDraft.publishAt, now))
		.orderBy(asc(postDraft.publishAt))
		.limit(PUBLISH_BATCH);

	let published = 0;
	let failed = 0;
	for (const { draft, banned, banExpires } of due) {
		try {
			if (banned && (!banExpires || banExpires > now)) {
				throw new ApiError(403, 'forbidden', 'Your account is suspended');
			}
			if (await publishDraft(db, platform, draft)) published++;
		} catch (err) {
			if (!(err instanceof ApiError)) console.error(`[drafts] Publishing ${draft.id} failed:`, err);
			failed++;
			await db
				.update(postDraft)
				.set({
					publishAt: null,
					lastError: err instanceof ApiError ? err.message : 'Something went wrong'
				})
				.where(eq(postDraft.id, draft.id));
		}
	}
	return { published, failed };
}
