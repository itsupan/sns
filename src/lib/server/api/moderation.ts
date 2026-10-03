import * as v from 'valibot';
import { MODERATION_NOTE_MAX } from '$lib/moderation';
import type { QueueItem } from '$lib/server/db/moderation';
import { refreshMediaUrl } from '$lib/server/services/storage';

/** A moderator's optional note on an action, kept in the audit trail. */
export const ModerationNote = v.optional(
	v.nullable(
		v.pipe(
			v.string('Note must be text'),
			v.trim(),
			v.maxLength(MODERATION_NOTE_MAX, `Note must be at most ${MODERATION_NOTE_MAX} characters`)
		)
	)
);

/** A user with a fresh presigned avatar URL. */
export async function withFreshAvatar<T extends { image: string | null }>(
	user: T,
	env?: Partial<Env>
): Promise<T> {
	return user.image ? { ...user, image: await refreshMediaUrl(user.image, env) } : user;
}

/** A queue item with fresh presigned URLs for its media and owner avatar. */
export async function withFreshUrls(item: QueueItem, env?: Partial<Env>): Promise<QueueItem> {
	const { target } = item;
	if (!target) return item;
	const [owner, media] = await Promise.all([
		withFreshAvatar(target.owner, env),
		target.media &&
			refreshMediaUrl(target.media.url, env).then((url) => ({ ...target.media!, url }))
	]);
	return { ...item, target: { ...target, owner, media } };
}
