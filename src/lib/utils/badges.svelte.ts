/**
 * Unread counts for the header and nav badges. One request fetches both; the header refreshes it
 * on navigation and when the tab becomes visible (no timers, to keep requests low).
 */
class BadgeStore {
	messages = $state(0);
	activity = $state(0);
	private inFlight: Promise<void> | null = null;

	/** Fetches fresh counts; concurrent calls share one request. Keeps the last counts on error. */
	refresh(): Promise<void> {
		this.inFlight ??= (async () => {
			try {
				const res = await fetch('/api/badges');
				if (!res.ok) return;
				const body = (await res.json()) as { messages: number; activity: number };
				this.messages = body.messages;
				this.activity = body.activity;
			} catch {
				// Keep the last known counts.
			} finally {
				this.inFlight = null;
			}
		})();
		return this.inFlight;
	}

	/** Signed out: nothing is unread. */
	clear() {
		this.messages = 0;
		this.activity = 0;
	}
}

export const badges = new BadgeStore();
