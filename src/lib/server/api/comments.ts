import type { CommentDto } from '$lib/server/db/comments';
import { refreshMediaUrl } from '$lib/server/services/storage';

/** Re-signs author avatars stored in R2 so the client never gets an expired URL. */
export function withFreshAvatars(
	comments: CommentDto[],
	env: Partial<Env> | undefined
): Promise<CommentDto[]> {
	return Promise.all(
		comments.map(async (c) =>
			c.author.avatar
				? { ...c, author: { ...c.author, avatar: await refreshMediaUrl(c.author.avatar, env) } }
				: c
		)
	);
}
