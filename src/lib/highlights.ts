import type { StoryAudience } from '$lib/stories';

/** Highlights one user may keep, and stories one highlight may hold. */
export const MAX_HIGHLIGHTS_PER_USER = 50;
export const MAX_HIGHLIGHT_ITEMS = 100;
export const MAX_HIGHLIGHT_TITLE = 30;

/** A story kept in a highlight or the archive (media URL already signed for viewing). */
export interface SavedStory {
	id: string;
	userId: string;
	mediaUrl: string;
	mediaType: 'image' | 'video';
	caption: string | null;
	location: string | null;
	audience: StoryAudience;
	createdAt: number;
	expiresAt: number;
}

/** A highlight as `/api/users/:id/highlights` returns it: only the stories the viewer may see. */
export interface HighlightData {
	id: string;
	title: string;
	coverStoryId: string | null;
	/** In playing order. */
	stories: SavedStory[];
	createdAt: number;
	updatedAt: number;
}

/** The highlight's cover: its chosen story when the viewer can see it, else the first one. */
export function highlightCover(highlight: HighlightData): SavedStory | null {
	return (
		highlight.stories.find((s) => s.id === highlight.coverStoryId) ?? highlight.stories[0] ?? null
	);
}
