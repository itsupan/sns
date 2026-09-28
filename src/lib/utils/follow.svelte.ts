import { readApiError } from './api-error';

/**
 * Follow state changed in this tab, keyed by user id. Server-rendered data says who the viewer
 * followed at load time; these overrides make every post card (and the profile header) for the
 * same person switch together after a click, without reloading.
 */
class FollowStore {
	private overrides = $state<Record<string, boolean>>({});
	private pending = $state<Record<string, boolean>>({});

	/** Current state for `userId`, falling back to what the server loaded. */
	isFollowing(userId: string, loaded = false): boolean {
		return this.overrides[userId] ?? loaded;
	}

	isPending(userId: string): boolean {
		return Boolean(this.pending[userId]);
	}

	/**
	 * Follows (POST) or unfollows (DELETE) optimistically and rolls back on failure.
	 * Resolves with the new follower count, or throws with the API's error message.
	 */
	async set(userId: string, follow: boolean): Promise<number | undefined> {
		const previous = this.overrides[userId];
		this.overrides[userId] = follow;
		this.pending[userId] = true;
		try {
			const res = await fetch(`/api/users/${encodeURIComponent(userId)}/follow`, {
				method: follow ? 'POST' : 'DELETE'
			});
			const body = (await res.json().catch(() => null)) as {
				following?: boolean;
				followersCount?: number;
			} | null;
			if (!res.ok || typeof body?.following !== 'boolean') {
				throw new Error(readApiError(body, 'Could not update follow').message);
			}
			this.overrides[userId] = body.following;
			return body.followersCount;
		} catch (err) {
			if (previous === undefined) delete this.overrides[userId];
			else this.overrides[userId] = previous;
			throw err;
		} finally {
			delete this.pending[userId];
		}
	}
}

export const followStore = new FollowStore();
