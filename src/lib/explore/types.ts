import type { TextBackground } from '$lib/post-backgrounds';

/** A post tile on Explore and tag pages. */
export interface ExploreTile {
	id: string;
	title: string;
	cover: { url: string; type: 'image' | 'video' } | null;
	/** Text posts: the background the title is shown on. */
	background?: TextBackground;
	isCarousel: boolean;
	likes: number;
	comments: number;
}

export interface TrendingTag {
	slug: string;
	name: string;
	posts: number;
}

export interface SuggestedCreator {
	id: string;
	name: string;
	/** Display handle, e.g. `@bob`. */
	handle: string;
	/** Segment for `/profile/[id]`. */
	slug: string;
	image: string | null;
	followersCount: number;
	mutuals: number;
}
