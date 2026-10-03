import { uploadToR2 } from '$lib/utils/upload';
import { toast } from '$lib/utils/toast.svelte';
import {
	MAX_MEDIA_PER_POST,
	MAX_TAGS_PER_POST,
	MAX_TAG_LENGTH,
	MAX_TEXT_POST_LENGTH
} from '$lib/constants/post-limits';
import { DEFAULT_TEXT_BACKGROUND, type TextBackground } from '$lib/post-backgrounds';
import type { PostData, PostType } from './PostCard.svelte';
import type { IconName } from '$lib/components/shared/icons';

export type { PostType };
export type AspectRatio = '1:1' | '4:5' | '16:9';

export interface MediaPlate {
	id: string;
	url: string;
	previewUrl: string;
	type: 'image' | 'video';
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

/**
 * Everything the post composer edits: text, media plates (uploaded as they are added), tags.
 * Shared by the create composer and the edit form so both behave and submit the same way.
 */
export class PostDraft {
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
		draft.mediaPlates = media.map((m) => ({
			id: crypto.randomUUID(),
			url: m.url,
			previewUrl: m.url,
			type: m.type
		}));
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
				tags: this.tags
			};
		}
		const mediaUrls = this.mediaPlates
			.filter((p) => p.url)
			.map((p) => ({ url: p.url, type: p.type }));
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
		this.content = '';
		this.title = '';
		this.location = '';
		this.tags = [];
		this.tagInput = '';
		this.removeAllMedia();
	}
}
