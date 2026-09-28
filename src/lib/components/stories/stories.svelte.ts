import { readApiError } from '$lib/utils/api-error';

/** One story as returned by `/api/stories` (media URL already signed for viewing). */
export interface Story {
	id: string;
	userId: string;
	mediaUrl: string;
	mediaType: 'image' | 'video';
	caption: string | null;
	location: string | null;
	createdAt: number;
	expiresAt: number;
	/** Whether the viewer has watched it (server-side, so it matches across devices). */
	seen?: boolean;
	/** Your own stories only: how many people watched it. */
	viewCount?: number;
}

export interface StoryGroup {
	user: { id: string; name: string; handle: string | null; image: string | null };
	isSelf: boolean;
	/** Oldest first: the order they are watched in. */
	stories: Story[];
}

/**
 * Stories tray state: the groups from `GET /api/stories`. Watched state comes from the server
 * (`story.seen`); stories watched in this tab are tracked locally until the next load.
 */
class StoriesStore {
	groups = $state<StoryGroup[]>([]);
	loading = $state(false);
	loaded = $state(false);
	private seenHere = $state<Record<string, true>>({});

	/** Own group first, then groups with unseen stories, then fully watched ones. */
	ordered = $derived(
		[...this.groups].sort(
			(a, b) =>
				Number(b.isSelf) - Number(a.isSelf) || Number(this.hasUnseen(b)) - Number(this.hasUnseen(a))
		)
	);

	own = $derived(this.groups.find((g) => g.isSelf) ?? null);

	async load(fetcher: typeof fetch = fetch) {
		if (this.loading) return;
		this.loading = true;
		try {
			const res = await fetcher('/api/stories');
			const body = (await res.json().catch(() => null)) as { groups?: StoryGroup[] } | null;
			if (!res.ok) throw new Error(readApiError(body, 'Could not load stories').message);
			this.groups = body?.groups ?? [];
			this.seenHere = {};
		} catch {
			this.groups = [];
		} finally {
			this.loading = false;
			this.loaded = true;
		}
	}

	isSeen(story: Story) {
		return Boolean(story.seen || this.seenHere[story.id]);
	}

	hasUnseen(group: StoryGroup) {
		return group.stories.some((s) => !this.isSeen(s));
	}

	/** Marks a story watched here and records the view (not for your own stories). */
	markSeen(story: Story, fetcher: typeof fetch = fetch) {
		if (this.isSeen(story)) return;
		this.seenHere[story.id] = true;
		const own = this.groups.find((g) => g.isSelf)?.stories.some((s) => s.id === story.id);
		if (own) return;
		fetcher(`/api/stories/${encodeURIComponent(story.id)}/view`, { method: 'POST' }).catch(() => {
			// Best effort: the ring is already grey locally; the view is retried next time it opens.
		});
	}

	/** Adds a story you just shared to your own group. */
	addOwn(story: Story, self: StoryGroup['user']) {
		const own = this.groups.find((g) => g.isSelf);
		if (own) own.stories = [...own.stories, story];
		else this.groups = [{ user: self, isSelf: true, stories: [story] }, ...this.groups];
		this.seenHere[story.id] = true;
	}

	remove(storyId: string) {
		this.groups = this.groups
			.map((g) => ({ ...g, stories: g.stories.filter((s) => s.id !== storyId) }))
			.filter((g) => g.stories.length > 0);
	}
}

export const storiesStore = new StoriesStore();
