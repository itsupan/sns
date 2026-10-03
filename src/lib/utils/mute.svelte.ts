import { readApiError } from './api-error';

/**
 * Mutes changed in this tab, keyed by user id. Server-rendered data says who the viewer muted at
 * load time; these overrides make every post card (and the profile header) for the same person
 * switch together after a click, without reloading.
 */
class MuteStore {
	private overrides = $state<Record<string, boolean>>({});
	private pending = $state<Record<string, boolean>>({});

	/** Whether the viewer muted `userId`, falling back to what the server loaded. */
	muted(userId: string, loaded = false): boolean {
		return this.overrides[userId] ?? loaded;
	}

	isPending(userId: string): boolean {
		return Boolean(this.pending[userId]);
	}

	/** Mutes (POST) or unmutes (DELETE); throws with the API's error message. */
	async set(userId: string, mute: boolean): Promise<void> {
		this.pending[userId] = true;
		try {
			const res = await fetch(`/api/users/${encodeURIComponent(userId)}/mute`, {
				method: mute ? 'POST' : 'DELETE'
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(readApiError(body, 'Could not update mute').message);
			}
			this.overrides[userId] = mute;
		} finally {
			delete this.pending[userId];
		}
	}
}

export const muteStore = new MuteStore();
