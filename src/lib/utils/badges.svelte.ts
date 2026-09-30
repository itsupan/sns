/**
 * Unread counts for the header and nav badges. One request fetches both; the header refreshes it
 * on navigation and when the tab becomes visible (no timers, to keep requests low).
 */
class BadgeStore {
	messages = $state(0);
	activity = $state(0);
	private inFlight: Promise<void> | null = null;
	/** Bumped by `clear()`, so a response that started before sign-out is ignored. */
	private generation = 0;

	/** Fetches fresh counts; concurrent calls share one request. Keeps the last counts on error. */
	refresh(): Promise<void> {
		if (this.inFlight) return this.inFlight;
		const generation = this.generation;
		const request = (async () => {
			try {
				const res = await fetch('/api/badges');
				if (!res.ok) return;
				const body = (await res.json()) as { messages: number; activity: number };
				if (generation !== this.generation) return;
				this.messages = body.messages;
				this.activity = body.activity;
			} catch {
				// Keep the last known counts.
			} finally {
				if (this.inFlight === request) this.inFlight = null;
			}
		})();
		this.inFlight = request;
		return request;
	}

	/** Signed out: nothing is unread, and any pending refresh is discarded. */
	clear() {
		this.generation++;
		this.inFlight = null;
		this.messages = 0;
		this.activity = 0;
	}
}

export const badges = new BadgeStore();
