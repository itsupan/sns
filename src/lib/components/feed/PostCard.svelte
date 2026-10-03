<script lang="ts">
	import FormattedText from '$lib/components/shared/FormattedText.svelte';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';
	import SheetAction from '$lib/components/shared/SheetAction.svelte';
	import ReportSheet from '$lib/components/shared/ReportSheet.svelte';
	import { formatCount, likesSummary } from '$lib/utils/format';
	import { TEXT_BACKGROUNDS, type TextBackground } from '$lib/post-backgrounds';
	import type { PollData } from '$lib/polls';
	import { toast } from '$lib/utils/toast.svelte';
	import { authClient } from '$lib/auth-client';
	import SharePostModal from './SharePostModal.svelte';
	import PostCommentsModal from './PostCommentsModal.svelte';
	import EditPostModal, { type PostEdits } from './EditPostModal.svelte';
	import QuoteComposer from './QuoteComposer.svelte';
	import QuotedPostCard from './QuotedPostCard.svelte';
	import PostPoll from './PostPoll.svelte';
	import { refreshExpiredMediaUrl } from '$lib/utils/media-refresh';
	import { FEED_IMAGE_WIDTHS, imageSrcset } from '$lib/utils/image';
	import { readApiError } from '$lib/utils/api-error';
	import {
		FOLLOW_LABELS,
		followStore,
		followToast,
		type FollowStatus
	} from '$lib/utils/follow.svelte';
	import { muteStore } from '$lib/utils/mute.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	export interface PostAuthor {
		id?: string;
		name: string;
		handle: string;
		avatar: string;
		location?: string;
		timeAgo?: string;
		/** Whether the viewer follows this author (false when signed out or for your own posts). */
		isFollowing?: boolean;
		/** Whether the viewer muted this author. */
		isMuted?: boolean;
	}

	export interface PostComment {
		id?: string;
		author: string;
		content: string;
	}

	export type PostType = 'photo' | 'story' | 'article' | 'text';

	export interface MediaItem {
		url: string;
		type: 'image' | 'video';
		/** Author-written description for screen readers. */
		alt?: string;
	}

	export interface PostData {
		id: string;
		author: PostAuthor;
		title: string;
		description: string;
		image: string;
		mediaUrl?: string;
		mediaType?: 'image' | 'video' | 'none';
		mediaItems?: MediaItem[];
		aspectRatio?: '1:1' | '4:5' | '16:9';
		postType?: PostType;
		/** Text posts: the background preset the text sits on. */
		background?: TextBackground;
		/** Text posts: a poll, with the viewer's vote. */
		poll?: PollData;
		location?: string;
		cameraMeta?: string;
		tags: string[];
		likes: number;
		/** Most recent liker other than the viewer, for the "Liked by" line. */
		likedBy?: string;
		commentsCount: number;
		sharesCount: number;
		repostsCount?: number;
		commentPreview?: PostComment;
		liked?: boolean;
		saved?: boolean;
		/** Pinned to the top of the author's profile. */
		pinned?: boolean;
		/** Whether the viewer reposted this post. */
		reposted?: boolean;
		/** Set when the card stands for someone's repost of this post. */
		repostedBy?: { id: string; name: string; handle: string };
		/** Quote posts: the quoted post, or null once it is deleted or hidden from the viewer. */
		quoted?: QuotedPost | null;
	}

	/** What a quote post shows of the post it quotes. */
	export type QuotedPost = Pick<
		PostData,
		'id' | 'author' | 'title' | 'description' | 'mediaItems' | 'postType' | 'background'
	>;

	interface Props {
		post: PostData;
		class?: string;
		/** Load the image eagerly (first post in the feed, for LCP). */
		priority?: boolean;
		onLike?: (liked: boolean) => void;
		onSave?: (saved: boolean) => void;
		/** Called after the author deletes the post; the card hides itself either way. */
		onDelete?: (id: string) => void;
		onUpdate?: (post: PostData) => void;
		/** Show Follow / Following next to the author (off on profile pages, where the header has it). */
		showFollow?: boolean;
		/** Show the whole description instead of clamping it behind "See more" (the post page). */
		fullText?: boolean;
		/** Mark the post when it is pinned (profile pages, where pinned posts lead). */
		showPinned?: boolean;
	}

	let {
		post: postProp,
		class: className = '',
		priority = false,
		onLike,
		onSave,
		onDelete,
		onUpdate,
		showFollow = true,
		fullText = false,
		showPinned = false
	}: Props = $props();

	const session = authClient.useSession();

	// Author edits are applied locally so every parent (feed, profile, post page) stays in sync.
	let edits = $state<PostEdits | null>(null);
	let deleted = $state(false);
	let post = $derived<PostData>(edits ? { ...postProp, ...edits } : postProp);
	let isOwner = $derived(Boolean(post.author.id && $session.data?.user?.id === post.author.id));

	// Author's profile: your own posts go to /profile, authors without an id fall back to the handle.
	let profileHref = $derived(
		isOwner
			? resolve('/profile')
			: resolve('/profile/[id]', {
					id: post.author.id ?? post.author.handle.replace(/^@/, '')
				})
	);
	let followStatus = $derived<FollowStatus>(
		post.author.id
			? followStore.status(post.author.id, post.author.isFollowing ? 'following' : 'none')
			: 'none'
	);
	let canFollow = $derived(showFollow && Boolean(post.author.id) && !isOwner);

	/** Signed out: shows `message` and sends the user to log in. Resolves to whether signed in. */
	async function requireSignIn(message: string): Promise<boolean> {
		if ($session.data?.user) return true;
		toast.show(message);
		const redirectTo = encodeURIComponent(window.location.pathname + window.location.search);
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(`${resolve('/login')}?redirectTo=${redirectTo}`).catch(() => {});
		return false;
	}

	async function toggleFollowAuthor() {
		const authorId = post.author.id;
		if (!authorId || followStore.isPending(authorId)) return;
		if (!(await requireSignIn('Please log in to follow curators'))) return;
		try {
			const { status } = await followStore.set(authorId, followStatus === 'none');
			toast.show(followToast(status, post.author.name));
		} catch (err) {
			toast.show(err instanceof Error ? err.message : 'Could not update follow');
		}
	}
	let editOpen = $state(false);
	let confirmDeleteOpen = $state(false);
	let deleting = $state(false);
	let pinning = $state(false);

	let likedOverride = $state<boolean | null>(null);
	let savedOverride = $state<boolean | null>(null);
	let pinnedOverride = $state<boolean | null>(null);
	let likesDelta = $state(0);
	let likePop = $state(0);
	let burst = $state(0);
	let optionsOpen = $state(false);
	let commentsOpen = $state(false);
	let shareOpen = $state(false);
	let sharesDelta = $state(0);
	let repostOpen = $state(false);
	let quoteOpen = $state(false);
	let repostedOverride = $state<boolean | null>(null);
	let repostsDelta = $state(0);
	let commentsDelta = $state(0);
	let latestCommentPreview = $state<PostComment | undefined>(undefined);

	let activeSlide = $state(0);
	let touchStartX = $state(0);
	let touchEndX = $state(0);
	let videoErrors = $state<Record<number, boolean>>({});
	let dynamicMediaUrls = $state<Record<number, string>>({});

	async function handleVideoError(index: number, originalUrl: string) {
		const fresh = await refreshExpiredMediaUrl(originalUrl);
		if (fresh && fresh !== originalUrl) {
			dynamicMediaUrls[index] = fresh;
			videoErrors[index] = false;
		} else {
			videoErrors[index] = true;
		}
	}

	async function handleImageError(index: number, originalUrl: string) {
		const fresh = await refreshExpiredMediaUrl(originalUrl);
		if (fresh && fresh !== originalUrl) {
			dynamicMediaUrls[index] = fresh;
		}
	}

	function getVideoType(url: string): string {
		if (/\.webm(\?.*)?$/i.test(url)) return 'video/webm';
		if (/\.mov(\?.*)?$/i.test(url)) return 'video/quicktime';
		return 'video/mp4';
	}

	const allMedia = $derived.by<MediaItem[]>(() => {
		if (post.mediaItems && post.mediaItems.length > 0) {
			return post.mediaItems;
		}
		if (post.mediaUrl || post.image) {
			const src = post.mediaUrl || post.image;
			const isVid = post.mediaType === 'video' || /\.(mp4|webm|mov)(\?.*)?$/i.test(src);
			return [{ url: src, type: isVid ? 'video' : 'image' }];
		}
		return [];
	});

	const aspectClass = $derived.by(() => {
		if (post.aspectRatio === '1:1') {
			return 'aspect-square';
		}
		if (post.aspectRatio === '16:9') {
			return 'aspect-video';
		}
		return 'aspect-[4/5]';
	});

	function nextSlide(e?: MouseEvent) {
		e?.stopPropagation();
		if (allMedia.length > 1) {
			activeSlide = (activeSlide + 1) % allMedia.length;
		}
	}

	function prevSlide(e?: MouseEvent) {
		e?.stopPropagation();
		if (allMedia.length > 1) {
			activeSlide = (activeSlide - 1 + allMedia.length) % allMedia.length;
		}
	}

	function goToSlide(index: number, e?: MouseEvent) {
		e?.stopPropagation();
		activeSlide = index;
	}

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
	}

	function handleTouchEnd(e: TouchEvent) {
		touchEndX = e.changedTouches[0].clientX;
		const diff = touchStartX - touchEndX;
		if (Math.abs(diff) > 40) {
			if (diff > 0) {
				nextSlide();
			} else {
				prevSlide();
			}
		}
	}

	let textBackground = $derived(
		post.postType === 'text' && post.background ? TEXT_BACKGROUNDS[post.background] : null
	);
	let textSize = $derived(
		post.description.length <= 80
			? 'text-2xl lg:text-3xl'
			: post.description.length <= 160
				? 'text-xl lg:text-2xl'
				: 'text-lg lg:text-xl'
	);

	let isLiked = $derived(likedOverride !== null ? likedOverride : (post.liked ?? false));
	let isSaved = $derived(savedOverride !== null ? savedOverride : (post.saved ?? false));
	let isPinned = $derived(pinnedOverride ?? post.pinned ?? false);
	let likesCount = $derived(post.likes + likesDelta);
	let sharesCount = $derived(post.sharesCount + sharesDelta);
	let isReposted = $derived(repostedOverride ?? post.reposted ?? false);
	let repostsCount = $derived((post.repostsCount ?? 0) + repostsDelta);
	let displayCommentsCount = $derived(post.commentsCount + commentsDelta);
	let activeCommentPreview = $derived(latestCommentPreview || post.commentPreview);

	// Long descriptions are clamped; "See more" appears only when the text really overflows.
	let descriptionEl = $state<HTMLDivElement | null>(null);
	let expanded = $state(false);
	let overflows = $state(false);
	$effect(() => {
		void post.description;
		const el = descriptionEl;
		if (!el || expanded || fullText) return;
		const measure = () => (overflows = el.scrollHeight > el.clientHeight + 1);
		measure();
		// The clamp differs per breakpoint, so remeasure when the paragraph's size changes.
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	});

	function haptic() {
		navigator.vibrate?.(10);
	}

	function setLiked(next: boolean) {
		if (next === isLiked) return;
		likedOverride = next;
		likesDelta += next ? 1 : -1;
		if (next) likePop++;
		haptic();
		onLike?.(next);
	}

	// The endpoint toggles, so a second tap while one is in flight would flip the server twice.
	let likeInFlight = false;

	async function toggleLike() {
		if (likeInFlight) return;
		const next = !isLiked;
		setLiked(next);
		if (!$session.data?.user) return;

		likeInFlight = true;
		try {
			const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' });
			const body = (await res.json().catch(() => null)) as {
				liked?: boolean;
				likesCount?: number;
			} | null;
			if (!res.ok || typeof body?.liked !== 'boolean') {
				setLiked(!next);
				return;
			}
			// The server's answer wins over the optimistic guess.
			likedOverride = body.liked;
			if (typeof body.likesCount === 'number') likesDelta = body.likesCount - post.likes;
		} catch {
			setLiked(!next);
		} finally {
			likeInFlight = false;
		}
	}

	// Server state of the save, and whether a request is in flight. Taps while one is in flight
	// only change `savedOverride`; `syncSave` then sends the latest intent, so fast toggling
	// ends in the state the user last chose.
	let savedOnServer: boolean | null = null;
	let saveInFlight = false;

	async function syncSave() {
		if (saveInFlight) return;
		saveInFlight = true;
		try {
			savedOnServer ??= post.saved ?? false;
			while (savedOverride !== null && savedOverride !== savedOnServer) {
				const want: boolean = savedOverride;
				const res = await fetch(`/api/posts/${post.id}/save`, {
					method: want ? 'PUT' : 'DELETE'
				});
				if (!res.ok) throw new Error(readApiError(await res.json().catch(() => null), '').message);
				savedOnServer = want;
			}
		} catch (err) {
			savedOverride = savedOnServer;
			const message = err instanceof Error && err.message ? err.message : '';
			toast.show(message || 'Could not update saved posts');
		} finally {
			saveInFlight = false;
		}
	}

	let authorMuted = $derived(
		post.author.id ? muteStore.muted(post.author.id, post.author.isMuted) : false
	);

	async function toggleMuteAuthor() {
		optionsOpen = false;
		const authorId = post.author.id;
		if (!authorId || muteStore.isPending(authorId)) return;
		if (!(await requireSignIn('Please log in to mute accounts'))) return;
		const mute = !authorMuted;
		try {
			await muteStore.set(authorId, mute);
			toast.show(mute ? `Muted ${post.author.name}` : `Unmuted ${post.author.name}`);
		} catch (err) {
			toast.show(err instanceof Error ? err.message : 'Could not update mute');
		}
	}

	let reportOpen = $state(false);

	async function openReport() {
		optionsOpen = false;
		if (!(await requireSignIn('Please log in to report posts'))) return;
		reportOpen = true;
	}

	async function toggleSave() {
		if (!(await requireSignIn('Please log in to save posts'))) return;
		const next = !isSaved;
		savedOverride = next;
		haptic();
		toast.show(next ? 'Saved to your collection' : 'Removed from saved');
		onSave?.(next);
		await syncSave();
	}

	// Double-tap the photo to like (never un-likes, same as native apps).
	let lastTap = 0;
	async function handleMediaTap() {
		const now = Date.now();
		if (now - lastTap < 300) {
			burst++;
			if (!isLiked) {
				await toggleLike();
			}
			lastTap = 0;
		} else {
			lastTap = now;
		}
	}

	function openShare() {
		optionsOpen = false;
		shareOpen = true;
	}

	// Shares are counted per signed-in user on the server; the count shown is the server's.
	async function handleShared() {
		if (!$session.data?.user) return;
		try {
			const res = await fetch(`/api/posts/${post.id}/share`, { method: 'POST' });
			const body = (await res.json().catch(() => null)) as { sharesCount?: number } | null;
			if (res.ok && typeof body?.sharesCount === 'number') {
				sharesDelta = body.sharesCount - post.sharesCount;
			}
		} catch {
			// The share itself already happened; only the counter is left unchanged.
		}
	}

	async function openRepost() {
		if (await requireSignIn('Please log in to repost')) repostOpen = true;
	}

	let repostInFlight = false;

	// Not optimistic: the sheet closes at once and the server's answer sets state and count.
	async function toggleRepost() {
		repostOpen = false;
		if (repostInFlight) return;
		repostInFlight = true;
		try {
			const res = await fetch(`/api/posts/${post.id}/repost`, {
				method: isReposted ? 'DELETE' : 'POST'
			});
			const body = (await res.json().catch(() => null)) as {
				reposted?: boolean;
				repostsCount?: number;
			} | null;
			if (!res.ok || typeof body?.reposted !== 'boolean') {
				toast.show(readApiError(body, 'Could not update your repost').message);
				return;
			}
			repostedOverride = body.reposted;
			if (typeof body.repostsCount === 'number') {
				repostsDelta = body.repostsCount - (post.repostsCount ?? 0);
			}
			haptic();
			toast.show(body.reposted ? 'Reposted' : 'Repost removed');
		} catch {
			toast.show('Could not update your repost');
		} finally {
			repostInFlight = false;
		}
	}

	function openQuote() {
		repostOpen = false;
		quoteOpen = true;
	}

	function handleCommentAdded(comment: PostComment, newCount: number) {
		commentsDelta = newCount - post.commentsCount;
		latestCommentPreview = comment;
	}

	function handleCommentDeleted(commentId: string, newCount: number) {
		commentsDelta = newCount - post.commentsCount;
		if (latestCommentPreview?.id === commentId) latestCommentPreview = undefined;
	}

	function postUrl() {
		return `${window.location.origin}/post/${post.id}`;
	}

	async function copyLink() {
		optionsOpen = false;
		try {
			await navigator.clipboard.writeText(postUrl());
			toast.show('Link copied');
			handleShared();
		} catch {
			toast.show('Could not copy link');
		}
	}

	function openEdit() {
		optionsOpen = false;
		editOpen = true;
	}

	function handleEdited(next: PostEdits) {
		edits = next;
		// Media may have changed; restart the carousel on the new first slide.
		activeSlide = 0;
		dynamicMediaUrls = {};
		videoErrors = {};
		onUpdate?.({ ...postProp, ...next });
	}

	async function deletePost() {
		if (deleting) return;
		deleting = true;
		try {
			const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
			if (!res.ok && res.status !== 404) {
				const body = await res.json().catch(() => null);
				toast.show(readApiError(body, 'Could not delete this post').message);
				return;
			}
			confirmDeleteOpen = false;
			deleted = true;
			toast.show('Post deleted');
			onDelete?.(post.id);
		} catch {
			toast.show('Could not delete this post');
		} finally {
			deleting = false;
		}
	}

	async function togglePin() {
		optionsOpen = false;
		if (pinning) return;
		pinning = true;
		const pin = !isPinned;
		try {
			const res = await fetch(`/api/posts/${post.id}/pin`, { method: pin ? 'PUT' : 'DELETE' });
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				toast.show(readApiError(body, 'Could not update pinned posts').message);
				return;
			}
			pinnedOverride = pin;
			toast.show(pin ? 'Pinned to your profile' : 'Unpinned from your profile');
			onUpdate?.({ ...post, pinned: pin });
		} catch {
			toast.show('Could not update pinned posts');
		} finally {
			pinning = false;
		}
	}

	const actionButton =
		'min-w-11 h-11 -my-1 flex items-center justify-center gap-1.5 rounded-full transition cursor-pointer border-0 bg-transparent active:scale-90';
</script>

{#if !deleted}
	<article
		id={post.id}
		class="post-card w-full flex flex-col bg-white dark:bg-dark-card border-y lg:border border-slate-100 dark:border-dark-border rounded-none lg:rounded-3xl pt-3 pb-2 lg:p-7 mb-2 lg:mb-6 shadow-none lg:shadow-xs dark:shadow-none transition-colors duration-200 {className}"
		aria-labelledby={post.title ? `post-title-${post.id}` : undefined}
		aria-label={post.title ? undefined : `Post by ${post.author.name}`}
	>
		{#if showPinned && isPinned}
			<p
				class="flex items-center gap-1.5 px-4 lg:px-0 mb-2 text-xs font-semibold text-slate-500 dark:text-dark-muted"
			>
				<Icon name="pin" class="text-xs" />
				Pinned
			</p>
		{/if}
		{#if post.repostedBy}
			<p
				class="flex items-center gap-1.5 px-4 lg:px-0 m-0 mb-2 text-xs font-medium text-slate-500 dark:text-dark-muted"
			>
				<Icon name="arrows-repeat" class="text-sm" />
				{#if post.repostedBy.id === $session.data?.user?.id}
					<span>You reposted</span>
				{:else}
					<a
						href={resolve('/profile/[id]', { id: post.repostedBy.id })}
						class="font-semibold text-slate-700 dark:text-dark-text no-underline hover:underline truncate"
					>
						{post.repostedBy.name}
					</a>
					<span class="shrink-0">reposted</span>
				{/if}
			</p>
		{/if}

		<!-- Post Header: Author info & options -->
		<header class="flex items-center justify-between px-4 lg:px-0">
			<div class="flex items-center gap-3 min-w-0">
				<a
					href={profileHref}
					class="shrink-0 rounded-full"
					aria-label={`View ${post.author.name}'s profile`}
				>
					<Avatar src={post.author.avatar} name={post.author.name} size="md" />
				</a>
				<div class="flex flex-col min-w-0">
					<div class="flex items-center gap-1.5 leading-tight min-w-0">
						<a
							href={profileHref}
							class="font-semibold text-sm text-slate-900 dark:text-dark-text truncate no-underline hover:underline"
						>
							{post.author.name}
						</a>
						<span class="text-xs text-slate-500 dark:text-dark-muted truncate">
							{post.author.handle}
						</span>
						{#if canFollow}
							<span class="text-xs text-slate-400 dark:text-dark-subtle" aria-hidden="true">•</span>
							<button
								type="button"
								class="shrink-0 text-xs font-semibold border-0 bg-transparent p-0 cursor-pointer transition-colors {followStatus !==
								'none'
									? 'text-slate-500 dark:text-dark-muted hover:text-slate-800 dark:hover:text-dark-text'
									: 'text-blue-600 dark:text-kizuna-blue hover:text-blue-700'}"
								aria-pressed={followStatus !== 'none'}
								onclick={toggleFollowAuthor}
							>
								{FOLLOW_LABELS[followStatus]}
							</button>
						{/if}
					</div>
					{#if post.location || post.author.location || post.author.timeAgo}
						<span class="text-xs text-slate-500 dark:text-dark-subtle mt-0.5 truncate">
							{[post.location || post.author.location, post.author.timeAgo]
								.filter(Boolean)
								.join(' • ')}
						</span>
					{/if}
				</div>
			</div>

			<button
				type="button"
				class="size-11 -mr-2 shrink-0 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-hover active:scale-90 transition cursor-pointer border-0 bg-transparent"
				aria-label="Post options"
				aria-haspopup="dialog"
				onclick={() => (optionsOpen = true)}
			>
				<Icon name="menu-dots" class="text-base" />
			</button>
		</header>

		<!-- Title -->
		{#if post.title}
			<h2
				id={`post-title-${post.id}`}
				class="px-4 lg:px-0 text-lg lg:text-xl font-bold text-slate-950 dark:text-white mt-3 lg:mt-4 mb-3 tracking-tight leading-snug"
			>
				{post.title}
			</h2>
		{:else}
			<div class="h-3"></div>
		{/if}

		<!-- Media: full-bleed on phones & vertical tablets, rounded on larger screens. Multi-image carousel with counter & dots. Double-tap to like. -->
		{#if textBackground}
			<div
				class="w-full aspect-square sm:aspect-[4/3] rounded-none lg:rounded-2xl overflow-hidden mb-3 lg:mb-4 flex items-center justify-center p-8 text-center text-white font-semibold leading-snug {textBackground} {textSize}"
				data-testid="text-post"
			>
				<FormattedText text={post.description} class="max-w-full drop-shadow-sm" />
			</div>
		{:else if allMedia.length > 0}
			{@const currentMedia = allMedia[activeSlide] ?? allMedia[0]}
			{@const activeMediaUrl = dynamicMediaUrls[activeSlide] || currentMedia.url}
			{@const isVideo =
				currentMedia.type === 'video' || /\.(mp4|webm|mov)(\?.*)?$/i.test(activeMediaUrl)}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="media-container relative w-full {aspectClass} rounded-none lg:rounded-2xl overflow-hidden bg-slate-100 dark:bg-dark-elevated mb-3 lg:mb-4 group select-none"
				onclick={handleMediaTap}
				ontouchstart={handleTouchStart}
				ontouchend={handleTouchEnd}
			>
				{#if isVideo}
					{#if videoErrors[activeSlide]}
						<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
						<div
							class="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center gap-3 select-auto"
							onclick={(e) => e.stopPropagation()}
							ontouchstart={(e) => e.stopPropagation()}
							ontouchend={(e) => e.stopPropagation()}
							role="region"
							aria-label="Video playback fallback"
						>
							<div
								class="size-12 rounded-full bg-white/10 flex items-center justify-center text-xl text-white"
							>
								<Icon name="play-alt" />
							</div>
							<div class="flex flex-col gap-1 max-w-xs">
								<p class="text-sm font-semibold">Video format not supported inline</p>
								<p class="text-xs text-slate-400">
									Your browser could not stream this video directly in the feed.
								</p>
							</div>
							<div class="flex items-center gap-2">
								<!-- eslint-disable svelte/no-navigation-without-resolve -- external direct media link -->
								<a
									href={activeMediaUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="px-4 py-2 rounded-xl bg-white text-slate-950 text-xs font-semibold hover:bg-slate-100 transition no-underline shadow-xs"
								>
									Open video in new tab
								</a>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
								<button
									type="button"
									onclick={async () => {
										videoErrors[activeSlide] = false;
										await handleVideoError(activeSlide, currentMedia.url);
									}}
									class="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition cursor-pointer border-0"
								>
									Retry
								</button>
							</div>
						</div>
					{:else}
						<video
							src={activeMediaUrl}
							controls
							playsinline
							preload="metadata"
							crossorigin="anonymous"
							class="w-full h-full object-cover"
							onclick={(e) => e.stopPropagation()}
							ontouchstart={(e) => e.stopPropagation()}
							ontouchend={(e) => e.stopPropagation()}
							onerror={() => {
								handleVideoError(activeSlide, currentMedia.url);
							}}
						>
							<source src={activeMediaUrl} type={getVideoType(activeMediaUrl)} />
							<track kind="captions" />
							Your browser does not support the video tag.
						</video>
					{/if}
				{:else}
					<img
						src={activeMediaUrl}
						alt={currentMedia.alt ||
							post.title ||
							`Photo by ${post.author.name} (Slide ${activeSlide + 1})`}
						srcset={imageSrcset(activeMediaUrl, FEED_IMAGE_WIDTHS)}
						sizes="(min-width: 672px) 672px, 100vw"
						class="w-full h-full object-cover transition-transform duration-300 sm:group-hover:scale-[1.01] pointer-events-none"
						loading={priority && activeSlide === 0 ? 'eager' : 'lazy'}
						fetchpriority={priority && activeSlide === 0 ? 'high' : 'auto'}
						decoding="async"
						draggable="false"
						onerror={() => {
							handleImageError(activeSlide, currentMedia.url);
						}}
					/>
				{/if}

				<!-- Multi-photo Counter Badge (Mockup 2 top-right: e.g. "1/4") -->
				{#if allMedia.length > 1}
					<div
						class="carousel-counter absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold tracking-wider select-none shadow-xs z-10"
						aria-label={`Slide ${activeSlide + 1} of ${allMedia.length}`}
					>
						{activeSlide + 1}/{allMedia.length}
					</div>

					<!-- Prev / Next Navigation Arrows -->
					{#if activeSlide > 0}
						<button
							type="button"
							class="absolute left-2.5 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-sm text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 border-0 cursor-pointer z-10 shadow-sm"
							onclick={prevSlide}
							aria-label="Previous slide"
						>
							<Icon name="angle-left" class="text-sm" />
						</button>
					{/if}

					{#if activeSlide < allMedia.length - 1}
						<button
							type="button"
							class="absolute right-2.5 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-sm text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 border-0 cursor-pointer z-10 shadow-sm"
							onclick={nextSlide}
							aria-label="Next slide"
						>
							<Icon name="angle-right" class="text-sm" />
						</button>
					{/if}

					<!-- Pagination Dots at Bottom Center (Mockup 2: active dot is pill, others are dots) -->
					<div
						class="carousel-dots absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm z-10 select-none"
						role="tablist"
						aria-label="Slide indicators"
					>
						{#each allMedia as item, idx (item.url + idx)}
							<button
								type="button"
								role="tab"
								class="transition-all rounded-full p-0 border-0 cursor-pointer {idx === activeSlide
									? 'w-4 h-1.5 bg-white'
									: 'size-1.5 bg-white/50 hover:bg-white/75'}"
								onclick={(e) => goToSlide(idx, e)}
								aria-label={`Go to slide ${idx + 1}`}
								aria-selected={idx === activeSlide}
							></button>
						{/each}
					</div>
				{/if}

				{#key burst}
					{#if burst > 0}
						<div
							class="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
							aria-hidden="true"
						>
							<Icon
								name="heart"
								type="sr"
								class="text-white text-[88px] drop-shadow-lg animate-heart-burst"
							/>
						</div>
					{/if}
				{/key}
			</div>
		{/if}

		{#if post.poll}
			<PostPoll postId={post.id} poll={post.poll} {isOwner} {requireSignIn} />
		{/if}

		<!-- Action Bar: sits right under the media on phones and vertical tablets, like native feeds -->
		<div
			class="action-bar flex items-center justify-between px-2 lg:px-0 lg:py-2 lg:order-1 lg:border-t border-slate-100 dark:border-dark-border text-slate-700 dark:text-dark-muted text-sm lg:text-xs font-medium"
		>
			<div class="flex items-center gap-0 lg:gap-3">
				<button
					type="button"
					class="{actionButton} px-2 {isLiked
						? 'text-rose-500 font-semibold'
						: 'hover:text-slate-900 dark:hover:text-dark-text'}"
					onclick={toggleLike}
					aria-label="Like post"
					aria-pressed={isLiked}
				>
					{#key likePop}
						<Icon
							name="heart"
							type={isLiked ? 'sr' : 'rr'}
							class="text-xl lg:text-base {likePop ? 'animate-heart-pop' : ''}"
						/>
					{/key}
					<span>{formatCount(likesCount)}</span>
				</button>

				<button
					type="button"
					class="{actionButton} px-2 hover:text-slate-900 dark:hover:text-dark-text"
					aria-label="Comments"
					onclick={() => (commentsOpen = true)}
				>
					<Icon name="comment" class="text-xl lg:text-base" />
					<span>{formatCount(displayCommentsCount)}</span>
				</button>

				<button
					type="button"
					class="{actionButton} px-2 {isReposted
						? 'text-emerald-600 dark:text-emerald-400 font-semibold'
						: 'hover:text-slate-900 dark:hover:text-dark-text'}"
					aria-label="Repost"
					aria-haspopup="dialog"
					aria-pressed={isReposted}
					onclick={openRepost}
				>
					<Icon name="arrows-repeat" class="text-xl lg:text-base" />
					<span>{formatCount(repostsCount)}</span>
				</button>
			</div>

			<div class="flex items-center">
				<button
					type="button"
					class="{actionButton} {isSaved
						? 'text-blue-600 dark:text-kizuna-blue'
						: 'hover:text-slate-900 dark:hover:text-dark-text'}"
					onclick={toggleSave}
					aria-label={isSaved ? 'Remove bookmark' : 'Save bookmark'}
					aria-pressed={isSaved}
				>
					<Icon name="bookmark" type={isSaved ? 'sr' : 'rr'} class="text-xl lg:text-base" />
				</button>

				<button
					type="button"
					class="{actionButton} px-2 hover:text-slate-900 dark:hover:text-dark-text"
					aria-label="Share post"
					onclick={openShare}
				>
					<Icon name="paper-plane" class="text-xl lg:text-base" />
					<span>{formatCount(sharesCount)}</span>
				</button>
			</div>
		</div>

		<p
			class="px-4 lg:px-0 lg:order-1 m-0 mt-1 lg:mt-0 text-sm font-semibold text-slate-900 dark:text-dark-text"
			data-testid="likes-summary"
		>
			{likesSummary(likesCount, isLiked, post.likedBy)}
		</p>

		<div class="px-4 lg:px-0 flex flex-col">
			<!-- Caption / Description (a text post shows it on its background instead) -->
			{#if post.description && !textBackground}
				<div class="mt-1.5 lg:mt-0 mb-3">
					<div
						bind:this={descriptionEl}
						class={expanded || fullText ? '' : 'line-clamp-3 lg:line-clamp-8'}
					>
						<FormattedText
							text={post.description}
							class="text-sm leading-relaxed text-slate-700 dark:text-dark-muted m-0"
						/>
					</div>
					{#if overflows}
						<button
							type="button"
							class="mt-1 p-0 border-0 bg-transparent cursor-pointer text-sm font-medium text-slate-500 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text"
							aria-expanded={expanded}
							onclick={() => (expanded = !expanded)}
						>
							{expanded ? 'See less' : 'See more'}
						</button>
					{/if}
				</div>
			{/if}

			{#if post.quoted !== undefined}
				<div class="mb-3">
					<QuotedPostCard quoted={post.quoted} />
				</div>
			{/if}

			<!-- Tags -->
			{#if post.tags && post.tags.length > 0}
				<div
					class="flex items-center gap-2 mb-3 lg:mb-4.5 overflow-x-auto no-scrollbar lg:flex-wrap -mx-4 px-4 lg:mx-0 lg:px-0"
				>
					{#each post.tags as tag (tag)}
						<a
							href={resolve('/explore/tags/[tag]', { tag: tag.replace(/^#+/, '').toLowerCase() })}
							class="shrink-0 inline-flex items-center text-xs font-medium px-3 h-8 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-muted hover:bg-slate-200 dark:hover:bg-dark-hover hover:text-slate-900 dark:hover:text-dark-text active:scale-95 transition no-underline"
						>
							{tag}
						</a>
					{/each}
				</div>
			{/if}
		</div>

		<div class="px-4 lg:px-0 lg:order-2">
			<!-- Comment Preview -->
			{#if activeCommentPreview}
				<button
					type="button"
					class="comment-preview w-full text-left mb-1 lg:mt-3 lg:mb-0 p-3 rounded-xl bg-slate-50 dark:bg-dark-elevated text-xs leading-normal flex items-center justify-between gap-3 text-slate-700 dark:text-dark-muted border-0 cursor-pointer active:bg-slate-100 dark:active:bg-dark-hover"
					onclick={() => (commentsOpen = true)}
				>
					<span class="truncate">
						<strong class="font-semibold text-slate-900 dark:text-dark-text">
							{activeCommentPreview.author}
						</strong>
						<span class="ml-2">{activeCommentPreview.content}</span>
					</span>
					<span
						class="reply-link text-[11px] font-medium text-slate-500 dark:text-dark-muted shrink-0"
					>
						View all {formatCount(displayCommentsCount)}
					</span>
				</button>
			{/if}
		</div>
	</article>
{/if}

<!-- Mounted only while open: a feed of idle cards carries no dialogs. -->
{#if optionsOpen}
	<BottomSheet bind:open={optionsOpen} title="Post options">
		{#if isOwner}
			<SheetAction icon="pencil" label="Edit post" onclick={openEdit} />
			<SheetAction
				icon={isPinned ? 'pin-off' : 'pin'}
				label={isPinned ? 'Unpin' : 'Pin to profile'}
				onclick={togglePin}
			/>
			<SheetAction
				icon="trash"
				label="Delete post"
				danger
				onclick={() => {
					optionsOpen = false;
					confirmDeleteOpen = true;
				}}
			/>
		{/if}
		<SheetAction
			icon="bookmark"
			label={isSaved ? 'Remove from saved' : 'Save'}
			onclick={() => {
				optionsOpen = false;
				toggleSave();
			}}
		/>
		<SheetAction icon="paper-plane" label="Share" onclick={openShare} />
		<SheetAction icon="link" label="Copy link" onclick={copyLink} />
		{#if !isOwner}
			{#if post.author.id}
				<SheetAction
					icon={authorMuted ? 'volume' : 'volume-mute'}
					label={authorMuted ? `Unmute ${post.author.name}` : `Mute ${post.author.name}`}
					onclick={toggleMuteAuthor}
				/>
			{/if}
			<SheetAction icon="flag" label="Report" danger onclick={openReport} />
		{/if}
	</BottomSheet>
{/if}

{#if editOpen}
	<EditPostModal bind:open={editOpen} {post} onSaved={handleEdited} />
{/if}

{#if confirmDeleteOpen}
	<BottomSheet bind:open={confirmDeleteOpen} title="Delete post?" showTitle>
		<p class="px-3 pb-2 text-sm text-slate-600 dark:text-dark-muted">
			This removes the post from your profile and everyone's feed. You can't undo this.
		</p>
		{#snippet footer()}
			<div class="flex justify-end gap-2">
				<button
					type="button"
					class="h-10 px-4 rounded-full text-sm font-semibold bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text border-0 cursor-pointer hover:bg-slate-200 dark:hover:bg-dark-hover"
					onclick={() => (confirmDeleteOpen = false)}
				>
					Cancel
				</button>
				<button
					type="button"
					class="h-10 px-5 rounded-full text-sm font-semibold bg-red-600 text-white border-0 cursor-pointer hover:bg-red-700 disabled:opacity-50 disabled:cursor-default"
					disabled={deleting}
					onclick={deletePost}
				>
					{deleting ? 'Deleting…' : 'Delete'}
				</button>
			</div>
		{/snippet}
	</BottomSheet>
{/if}

{#if reportOpen}
	<ReportSheet bind:open={reportOpen} targetType="post" targetId={post.id} />
{/if}

{#if shareOpen}
	<SharePostModal bind:open={shareOpen} {post} onShare={handleShared} />
{/if}

{#if repostOpen}
	<BottomSheet bind:open={repostOpen} title="Repost">
		<SheetAction
			icon="arrows-repeat"
			label={isReposted ? 'Undo repost' : 'Repost'}
			onclick={toggleRepost}
		/>
		<SheetAction icon="pencil" label="Quote" onclick={openQuote} />
	</BottomSheet>
{/if}

{#if quoteOpen}
	<QuoteComposer bind:open={quoteOpen} {post} />
{/if}

{#if commentsOpen}
	<PostCommentsModal
		bind:open={commentsOpen}
		{post}
		onCommentAdded={handleCommentAdded}
		onCommentDeleted={handleCommentDeleted}
	/>
{/if}
