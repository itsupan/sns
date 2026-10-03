import { readApiError } from './api-error';

/** The viewer's relation to an account: following it, asked to (a private account), or neither. */
export type FollowStatus = 'none' | 'requested' | 'following';

export const FOLLOW_LABELS: Record<FollowStatus, string> = {
	none: 'Follow',
	requested: 'Requested',
	following: 'Following'
};

/** Toast after a Follow button click settled on `status`. */
export function followToast(status: FollowStatus, name: string): string {
	if (status === 'none') return `Unfollowed ${name}`;
	return status === 'requested' ? `Requested to follow ${name}` : `Following ${name}`;
}

/** Accessible name of a Follow button for `name`, saying what a click does. */
export function followActionLabel(status: FollowStatus, name: string): string {
	if (status === 'none') return `Follow ${name}`;
	return status === 'requested' ? `Withdraw follow request to ${name}` : `Unfollow ${name}`;
}

/**
 * Follow state changed in this tab, keyed by user id. Server-rendered data says who the viewer
 * followed at load time; these overrides make every post card (and the profile header) for the
 * same person switch together after a click, without reloading.
 */
class FollowStore {
	private overrides = $state<Record<string, FollowStatus>>({});
	private pending = $state<Record<string, boolean>>({});

	/** Current status for `userId`, falling back to what the server loaded. */
	status(userId: string, loaded: FollowStatus = 'none'): FollowStatus {
		return this.overrides[userId] ?? loaded;
	}

	/** Drops the local override, e.g. after a block removed the follow on the server. */
	forget(userId: string): void {
		delete this.overrides[userId];
	}

	isPending(userId: string): boolean {
		return Boolean(this.pending[userId]);
	}

	/**
	 * Follows (POST), or unfollows and withdraws a request (DELETE), optimistically, rolling back on
	 * failure. A follow of a private account settles as `requested`. Resolves with the new status
	 * and follower count, or throws with the API's error message.
	 */
	async set(
		userId: string,
		follow: boolean
	): Promise<{ status: FollowStatus; followersCount?: number }> {
		const previous = this.overrides[userId];
		this.overrides[userId] = follow ? 'following' : 'none';
		this.pending[userId] = true;
		try {
			const res = await fetch(`/api/users/${encodeURIComponent(userId)}/follow`, {
				method: follow ? 'POST' : 'DELETE'
			});
			const body = (await res.json().catch(() => null)) as {
				status?: FollowStatus;
				followersCount?: number;
			} | null;
			const status = body?.status;
			if (!res.ok || !status || !Object.hasOwn(FOLLOW_LABELS, status)) {
				throw new Error(readApiError(body, 'Could not update follow').message);
			}
			this.overrides[userId] = status;
			return { status, followersCount: body?.followersCount };
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
