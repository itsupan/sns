/** What the service worker shows for one push message (see `src/service-worker.ts`). */
export type PushPayload = {
	title: string;
	body: string;
	/** Same-origin path opened, or focused when already open, on click. */
	url: string;
	/** A newer notification with the same tag replaces the older one. */
	tag: string;
};
