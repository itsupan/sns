/**
 * Stories live only in the STORIES KV namespace. Each story is one key written with
 * `expirationTtl: STORY_TTL_SEC`, so KV deletes it after 24 hours without any cleanup job.
 *
 * Key: `story:<userId>:<createdAtMs>` (ms timestamps are 13 digits until the year 2286, so keys
 * for one user sort by time). The story JSON is stored as the value and, when it fits, also as the
 * key's metadata so `list()` returns everything without a `get()` per story.
 */

export const STORY_TTL_SEC = 24 * 60 * 60;
export const MAX_STORY_CAPTION = 200;
export const MAX_STORY_LOCATION = 100;
/** Cap on authors read per request: one KV `list` each, well under the Workers subrequest limit. */
export const MAX_STORY_AUTHORS = 100;
// KV metadata is limited to 1024 bytes of serialized JSON.
const MAX_METADATA_BYTES = 1024;

export interface StoredStory {
	id: string;
	userId: string;
	mediaUrl: string;
	mediaType: 'image' | 'video';
	caption: string | null;
	location: string | null;
	createdAt: number;
	expiresAt: number;
}

export const storyKey = (userId: string, createdAt: number) => `story:${userId}:${createdAt}`;
const userPrefix = (userId: string) => `story:${userId}:`;

/** Story id is its KV key without the `story:` prefix, i.e. `<userId>:<createdAtMs>`. */
export const storyIdFromKey = (key: string) => key.slice('story:'.length);

export async function putStory(
	kv: KVNamespace,
	input: Omit<StoredStory, 'id' | 'createdAt' | 'expiresAt'>,
	now = Date.now()
): Promise<StoredStory> {
	const key = storyKey(input.userId, now);
	const story: StoredStory = {
		...input,
		id: storyIdFromKey(key),
		createdAt: now,
		expiresAt: now + STORY_TTL_SEC * 1000
	};
	const value = JSON.stringify(story);
	const fitsInMetadata = new TextEncoder().encode(value).length <= MAX_METADATA_BYTES;
	await kv.put(key, value, {
		expirationTtl: STORY_TTL_SEC,
		metadata: fitsInMetadata ? story : undefined
	});
	return story;
}

function isStory(value: unknown): value is StoredStory {
	const s = value as StoredStory | null;
	return (
		typeof s === 'object' &&
		s !== null &&
		typeof s.id === 'string' &&
		typeof s.userId === 'string' &&
		typeof s.mediaUrl === 'string' &&
		typeof s.createdAt === 'number'
	);
}

/** One user's active stories, oldest first (viewing order). */
export async function listUserStories(
	kv: KVNamespace,
	userId: string,
	now = Date.now()
): Promise<StoredStory[]> {
	const stories: StoredStory[] = [];
	let cursor: string | undefined;
	do {
		const page = await kv.list<StoredStory>({ prefix: userPrefix(userId), cursor });
		const found = await Promise.all(
			page.keys.map(async (k) =>
				isStory(k.metadata) ? k.metadata : await kv.get<StoredStory>(k.name, 'json')
			)
		);
		for (const story of found) {
			// KV expiry is eventually consistent; never show a story past 24h.
			if (isStory(story) && story.expiresAt > now) stories.push(story);
		}
		cursor = page.list_complete ? undefined : page.cursor;
	} while (cursor);
	return stories.sort((a, b) => a.createdAt - b.createdAt);
}

/** Active stories for many users, keyed by user id; users without stories are left out. */
export async function listStoriesByUser(
	kv: KVNamespace,
	userIds: string[],
	now = Date.now()
): Promise<Map<string, StoredStory[]>> {
	const ids = [...new Set(userIds)].slice(0, MAX_STORY_AUTHORS);
	const lists = await Promise.all(ids.map((id) => listUserStories(kv, id, now)));
	const byUser = new Map<string, StoredStory[]>();
	ids.forEach((id, i) => {
		if (lists[i].length > 0) byUser.set(id, lists[i]);
	});
	return byUser;
}

/*
 * Views. Two kinds of keys, both expiring with the story they belong to:
 * - `view:<storyId>:<viewerId>` — one per viewer (so repeat opens count once), listed by the author.
 * - `seen:<viewerId>` — that viewer's `{ storyId: expiresAtMs }` map, so the tray can show
 *   watched rings from one read instead of one read per story.
 */

// KV rejects expirations less than 60 seconds away.
const MIN_EXPIRATION_SEC = 60;

const viewPrefix = (storyId: string) => `view:${storyId}:`;
const viewKey = (storyId: string, viewerId: string) => `${viewPrefix(storyId)}${viewerId}`;
const seenKey = (viewerId: string) => `seen:${viewerId}`;

export interface StoryView {
	viewerId: string;
	viewedAt: number;
}

/** `<userId>:<createdAtMs>`, the id format `putStory` returns. */
export function parseStoryId(id: string): { userId: string; createdAt: number } | null {
	const match = /^([^:]+):(\d{1,16})$/.exec(id);
	return match ? { userId: match[1], createdAt: Number(match[2]) } : null;
}

export async function getStory(kv: KVNamespace, storyId: string, now = Date.now()) {
	const story = await kv.get<StoredStory>(`story:${storyId}`, 'json');
	return isStory(story) && story.expiresAt > now ? story : null;
}

/** Absolute KV expiration (seconds) matching the story's, or null when it is about to expire. */
function expirationFor(story: StoredStory, now: number): number | null {
	const expiration = Math.floor(story.expiresAt / 1000);
	return expiration - Math.floor(now / 1000) >= MIN_EXPIRATION_SEC ? expiration : null;
}

export async function getSeenStoryIds(
	kv: KVNamespace,
	viewerId: string,
	now = Date.now()
): Promise<Set<string>> {
	const seen = (await kv.get<Record<string, number>>(seenKey(viewerId), 'json')) ?? {};
	return new Set(Object.keys(seen).filter((id) => seen[id] > now));
}

/**
 * Records that `viewerId` watched `story`. Idempotent (a second open keeps the first time) and a
 * no-op for the author's own story. Returns whether a new view was counted.
 */
export async function recordView(
	kv: KVNamespace,
	story: StoredStory,
	viewerId: string,
	now = Date.now()
): Promise<boolean> {
	if (viewerId === story.userId) return false;
	const expiration = expirationFor(story, now);
	if (expiration === null) return false;

	const key = viewKey(story.id, viewerId);
	const counted = (await kv.get(key)) === null;
	if (counted) {
		const view: StoryView = { viewerId, viewedAt: now };
		await kv.put(key, JSON.stringify(view), { expiration, metadata: view });
	}

	// Watched-ring index for this viewer; expired entries are pruned on every write.
	const seen = (await kv.get<Record<string, number>>(seenKey(viewerId), 'json')) ?? {};
	if (!(story.id in seen)) {
		const next: Record<string, number> = { [story.id]: story.expiresAt };
		for (const [id, expiresAt] of Object.entries(seen)) {
			if (expiresAt > now) next[id] = expiresAt;
		}
		const lastExpiry = Math.max(...Object.values(next));
		await kv.put(seenKey(viewerId), JSON.stringify(next), {
			expiration: Math.max(
				Math.floor(lastExpiry / 1000),
				Math.floor(now / 1000) + MIN_EXPIRATION_SEC
			)
		});
	}
	return counted;
}

/** Everyone who watched a story, most recent first. */
export async function listViews(kv: KVNamespace, storyId: string): Promise<StoryView[]> {
	const views: StoryView[] = [];
	let cursor: string | undefined;
	do {
		const page = await kv.list<StoryView>({ prefix: viewPrefix(storyId), cursor });
		for (const k of page.keys) {
			if (k.metadata && typeof k.metadata.viewedAt === 'number') views.push(k.metadata);
		}
		cursor = page.list_complete ? undefined : page.cursor;
	} while (cursor);
	return views.sort((a, b) => b.viewedAt - a.viewedAt);
}

/** Deletes a story and its view records. */
export async function deleteStory(kv: KVNamespace, storyId: string): Promise<void> {
	await kv.delete(`story:${storyId}`);
	let cursor: string | undefined;
	do {
		const page = await kv.list({ prefix: viewPrefix(storyId), cursor });
		await Promise.all(page.keys.map((k) => kv.delete(k.name)));
		cursor = page.list_complete ? undefined : page.cursor;
	} while (cursor);
}
