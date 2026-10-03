/** Stories disappear this long after they are shared. */
export const STORY_TTL_SEC = 24 * 60 * 60;

/** Who sees a story: all of the author's followers, or only those on their close friends list. */
export const STORY_AUDIENCES = ['everyone', 'close_friends'] as const;
export type StoryAudience = (typeof STORY_AUDIENCES)[number];

/** Whether the story `id` (`<authorId>:<createdAtMs>`) is past its 24 hours. */
export function isStoryExpired(id: string, now = Date.now()): boolean {
	const createdAt = Number(id.slice(id.lastIndexOf(':') + 1));
	return !(createdAt + STORY_TTL_SEC * 1000 > now);
}

const storyDateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

/** The day a story was shared, in the viewer's locale and time zone: "Oct 3, 2026". */
export function formatStoryDate(createdAt: number): string {
	return storyDateFormat.format(createdAt);
}
