import type { ChatUser } from '$lib/chat/types';
import { refreshMediaUrl } from '$lib/server/services/storage';

/** Re-signs a chat user's avatar when it is stored in R2. */
export async function withFreshAvatar<T extends ChatUser>(
	u: T,
	env: Partial<Env> | undefined
): Promise<T> {
	return u.image ? { ...u, image: await refreshMediaUrl(u.image, env) } : u;
}
