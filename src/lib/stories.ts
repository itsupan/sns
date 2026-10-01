/** Stories disappear this long after they are shared. */
export const STORY_TTL_SEC = 24 * 60 * 60;

/** Whether the story `id` (`<authorId>:<createdAtMs>`) is past its 24 hours. */
export function isStoryExpired(id: string, now = Date.now()): boolean {
	const createdAt = Number(id.slice(id.lastIndexOf(':') + 1));
	return !(createdAt + STORY_TTL_SEC * 1000 > now);
}
