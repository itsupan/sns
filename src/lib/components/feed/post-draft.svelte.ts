import { uploadToR2 } from '$lib/utils/upload';
import { toast } from '$lib/utils/toast.svelte';
import { readApiError } from '$lib/utils/api-error';
import type { DraftData } from '$lib/drafts';
import {
	MAX_MEDIA_PER_POST,
	MAX_TAGS_PER_POST,
	MAX_TAG_LENGTH,
	MAX_TEXT_POST_LENGTH
} from '$lib/constants/post-limits';
import { DEFAULT_TEXT_BACKGROUND, type TextBackground } from '$lib/post-backgrounds';
import { DEFAULT_POLL_DURATION_MINUTES, MIN_POLL_OPTIONS } from '$lib/polls';
import type { MediaItem, PostData, PostType } from './PostCard.svelte';
import type { IconName } from '$lib/components/shared/icons';

export type { PostType };
export type AspectRatio = '1:1' | '4:5' | '16:9';

export interface MediaPlate {
	id: string;
	url: string;
	previewUrl: string;
	type: 'image' | 'video';
	/** Alt text for screen readers; images only. */
	alt: string;
	file?: File;
	uploading?: boolean;
	progress?: number;
}

export const POST_TYPES: { id: PostType; label: string; icon: IconName }[] = [
	{ id: 'photo', label: 'Photo', icon: 'picture' },
	{ id: 'story', label: 'Story', icon: 'play-alt' },
	{ id: 'article', label: 'Article', icon: 'document' },
	{ id: 'text', label: 'Text', icon: 'text' }
];

export const ASPECT_RATIOS: { id: AspectRatio; label: string; sub: string }[] = [
	{ id: '1:1', label: '1:1', sub: 'Square' },
	{ id: '4:5', label: '4:5', sub: 'Gallery' },
	{ id: '16:9', label: '16:9', sub: 'Cinema' }
];

export const MAX_CONTENT_LENGTH = 2200;

/** A poll option as the composer edits it; the id keys its input. */
export interface PollOptionField {
	id: string;
	label: string;
}

function pollOptionField(label: string): PollOptionField {
	return { id: crypto.randomUUID(), label };
}

function platesFrom(media: MediaItem[]): MediaPlate[] {
	return media.map((m) => ({
		id: crypto.randomUUID(),
		url: m.url,
		previewUrl: m.url,
		type: m.type,
		alt: m.alt ?? ''
	}));
}

/**
 * Everything the post composer edits: text, media plates (uploaded as they are added), tags.
 * Shared by the create composer and the edit form so both behave and submit the same way.
 */
export class PostDraft {
	/** The saved draft (`/api/drafts`) this was opened from or last saved to. */
	draftId = $state<string | null>(null);
	/** When that draft is scheduled to publish (ISO), or null. */
	scheduledAt = $state<string | null>(null);
	content = $state('');
	title = $state('');
	selectedType = $state<PostType>('photo');
	background = $state<TextBackground>(DEFAULT_TEXT_BACKGROUND);
	canvasRatio = $state<AspectRatio>('1:1');
	location = $state('');
	mediaPlates = $state<MediaPlate[]>([]);
	activePlateIndex = $state(0);
	tagInput = $state('');
	tags = $state<string[]>([]);
	/** Text posts: the options of the poll being added, or null without one. */
	pollOptions = $state<PollOptionField[] | null>(null);
	pollDuration = $state(DEFAULT_POLL_DURATION_MINUTES);

	isUploadingAny = $derived(this.mediaPlates.some((p) => p.uploading));
	/** Text posts are words on a background: no media, and a shorter limit. */
	isText = $derived(this.selectedType === 'text');
	maxLength = $derived(this.isText ? MAX_TEXT_POST_LENGTH : MAX_CONTENT_LENGTH);
	isEmpty = $derived(!this.content.trim() && (this.isText || this.mediaPlates.length === 0));
	activePlate = $derived(this.mediaPlates[this.activePlateIndex] ?? this.mediaPlates[0] ?? null);

	/** Draft pre-filled from an existing post, for editing. */
	static fromPost(post: PostData): PostDraft {
		const draft = new PostDraft();
		draft.content = post.description;
		draft.title = post.title;
		draft.selectedType = post.postType ?? 'photo';
		draft.background = post.background ?? DEFAULT_TEXT_BACKGROUND;
		draft.canvasRatio = post.aspectRatio ?? '1:1';
		draft.location = post.location ?? '';
		draft.tags = [...post.tags];
		const media =
			post.mediaItems && post.mediaItems.length > 0
				? post.mediaItems
				: post.mediaUrl || post.image
					? [
							{
								url: post.mediaUrl || post.image,
								type: post.mediaType === 'video' ? ('video' as const) : ('image' as const)
							}
						]
					: [];
		draft.mediaPlates = platesFrom(media);
		return draft;
	}

	/** Replaces what is being composed with a saved draft, to keep editing it. */
	loadDraft(saved: DraftData) {
		const { payload } = saved;
		this.reset();
		this.draftId = saved.id;
		this.scheduledAt = saved.publishAt;
		this.content = payload.content;
		this.title = payload.title ?? '';
		this.selectedType = payload.postType;
		this.background = payload.background ?? DEFAULT_TEXT_BACKGROUND;
		this.canvasRatio = payload.aspectRatio;
		this.location = payload.location ?? '';
		this.tags = payload.tags.map((t) => `#${t}`);
		this.mediaPlates = platesFrom(payload.mediaUrls);
		if (payload.poll) {
			this.pollOptions = payload.poll.options.map(pollOptionField);
			this.pollDuration = payload.poll.durationMinutes;
		}
	}

	/**
	 * Saves to `/api/drafts`: a new draft, or the one being edited. With `publishAt` the draft is
	 * scheduled; without, it is kept unscheduled.
	 */
	async saveDraft(publishAt: Date | null = null): Promise<DraftData> {
		const res = await fetch(this.draftId ? `/api/drafts/${this.draftId}` : '/api/drafts', {
			method: this.draftId ? 'PATCH' : 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				payload: this.toPayload(),
				publishAt: publishAt?.toISOString() ?? null
			})
		});
		const data = await res.json().catch(() => null);
		if (!res.ok) throw new Error(readApiError(data, 'Could not save the draft').message);
		const { draft } = data as { draft: DraftData };
		this.draftId = draft.id;
		this.scheduledAt = draft.publishAt;
		return draft;
	}

	/** Adds files as plates and uploads each one; failed uploads are dropped with a toast. */
	processFiles(files: FileList | File[]) {
		const mediaFiles = Array.from(files).filter(
			(f) => f.type.startsWith('image/') || f.type.startsWith('video/')
		);
		if (mediaFiles.length === 0) return;

		const room = MAX_MEDIA_PER_POST - this.mediaPlates.length;
		if (mediaFiles.length > room) {
			toast.show(`A post can have at most ${MAX_MEDIA_PER_POST} photos or videos`);
		}
		const validFiles = mediaFiles.slice(0, Math.max(room, 0));

		for (const file of validFiles) {
			const isVideo = file.type.startsWith('video/');
			const plateId = crypto.randomUUID();
			this.mediaPlates = [
				...this.mediaPlates,
				{
					id: plateId,
					url: '',
					previewUrl: URL.createObjectURL(file),
					type: isVideo ? 'video' : 'image',
					alt: '',
					file,
					uploading: true,
					progress: 0
				}
			];
			this.activePlateIndex = this.mediaPlates.length - 1;

			uploadToR2(file, {
				folder: 'posts',
				optimize: !isVideo,
				onProgress: (pct) => {
					this.mediaPlates = this.mediaPlates.map((p) =>
						p.id === plateId ? { ...p, progress: pct } : p
					);
				}
			})
				.then((result) => {
					this.mediaPlates = this.mediaPlates.map((p) =>
						p.id === plateId
							? {
									...p,
									url: result.publicUrl,
									previewUrl: result.publicUrl,
									uploading: false,
									progress: 100
								}
							: p
					);
					toast.show(`${isVideo ? 'Video' : 'Photo'} uploaded`);
				})
				.catch((err) => {
					toast.show(err instanceof Error ? err.message : 'Media upload failed');
					this.removePlate(plateId);
				});
		}
	}

	removePlate(id: string) {
		const target = this.mediaPlates.find((p) => p.id === id);
		if (target?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(target.previewUrl);
		this.mediaPlates = this.mediaPlates.filter((p) => p.id !== id);
		if (this.activePlateIndex >= this.mediaPlates.length) {
			this.activePlateIndex = Math.max(0, this.mediaPlates.length - 1);
		}
	}

	removeAllMedia() {
		for (const p of this.mediaPlates) {
			if (p.previewUrl.startsWith('blob:')) URL.revokeObjectURL(p.previewUrl);
		}
		this.mediaPlates = [];
		this.activePlateIndex = 0;
	}

	addTag() {
		const clean = this.tagInput.trim().replace(/^#+/, '').slice(0, MAX_TAG_LENGTH);
		if (clean && this.tags.length >= MAX_TAGS_PER_POST) {
			toast.show(`A post can have at most ${MAX_TAGS_PER_POST} tags`);
			return;
		}
		if (clean && !this.tags.some((t) => t.toLowerCase() === `#${clean}`.toLowerCase())) {
			this.tags = [...this.tags, `#${clean}`];
			this.tagInput = '';
		}
	}

	addPoll() {
		this.pollOptions = Array.from({ length: MIN_POLL_OPTIONS }, () => pollOptionField(''));
		this.pollDuration = DEFAULT_POLL_DURATION_MINUTES;
	}

	addPollOption() {
		this.pollOptions?.push(pollOptionField(''));
	}

	removePollOption(id: string) {
		this.pollOptions = this.pollOptions?.filter((o) => o.id !== id) ?? null;
	}

	removePoll() {
		this.pollOptions = null;
	}

	removeTag(tag: string) {
		this.tags = this.tags.filter((t) => t !== tag);
	}

	handleTagKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			this.addTag();
		}
	}

	/** Request body for POST /api/posts and PATCH /api/posts/:id. */
	toPayload() {
		const trimmed = this.content.trim();
		if (this.isText) {
			return {
				content: trimmed,
				title: null,
				mediaUrls: [],
				location: this.location.trim() || null,
				postType: this.selectedType,
				background: this.background,
				poll: this.pollOptions && {
					options: this.pollOptions.map((o) => o.label),
					durationMinutes: this.pollDuration
				},
				tags: this.tags
			};
		}
		const mediaUrls = this.mediaPlates
			.filter((p) => p.url)
			.map((p) => ({ url: p.url, type: p.type, alt: p.alt }));
		return {
			content: trimmed || (this.selectedType === 'photo' ? 'Visual Exhibition' : 'Note'),
			title:
				this.title.trim() ||
				(this.selectedType === 'article' ? trimmed.split('\n')[0].slice(0, 80) : null),
			mediaUrls,
			aspectRatio: this.canvasRatio,
			location: this.location.trim() || null,
			postType: this.selectedType,
			tags: this.tags
		};
	}

	reset() {
		this.draftId = null;
		this.scheduledAt = null;
		this.content = '';
		this.title = '';
		this.location = '';
		this.tags = [];
		this.tagInput = '';
		this.pollOptions = null;
		this.removeAllMedia();
	}
}
