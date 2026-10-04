<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import LoadMore from '$lib/components/shared/LoadMore.svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import { formatTimeAgo } from '$lib/utils/format';
	import { toast } from '$lib/utils/toast.svelte';
	import { readApiError } from '$lib/utils/api-error';
	import { FOLLOW_LABELS, followStore } from '$lib/utils/follow.svelte';
	import { MAX_MESSAGE_LENGTH } from '$lib/chat/types';
	import { STORY_REACTIONS, type StoryReaction } from '$lib/reactions';
	import type { Story, StoryGroup } from './stories.svelte';

	interface StoryViewer {
		id: string;
		name: string;
		handle: string | null;
		image: string | null;
		viewedAt: number;
		reaction: StoryReaction | null;
		isFollowing: boolean;
	}

	interface ViewersPage {
		count: number;
		viewers: StoryViewer[];
		nextCursor: string | null;
	}

	/** How long a photo stays on screen; videos play for their own length. */
	const IMAGE_DURATION_MS = 5000;
	const HOLD_MS = 200;
	const SWIPE_PX = 50;
	const CLOSE_DRAG_PX = 90;

	interface Props {
		open?: boolean;
		groups: StoryGroup[];
		/** Group to start on when opened. */
		startIndex?: number;
		onSeen?: (story: Story) => void;
		onDeleted?: (story: Story) => void;
	}

	let { open = $bindable(false), groups, startIndex = 0, onSeen, onDeleted }: Props = $props();

	let gi = $state(0);
	let si = $state(0);
	let progress = $state(0);
	let paused = $state(false);
	let held = $state(false);
	let muted = $state(true);
	let confirmDelete = $state(false);
	// "Viewers" panel on your own story.
	let viewersOpen = $state(false);
	let viewersLoading = $state(false);
	let viewers = $state<StoryViewer[]>([]);
	let viewersCount = $state(0);
	let viewersCursor = $state<string | null>(null);
	let viewersMoreLoading = $state(false);
	let viewersMoreError = $state<string | null>(null);
	let deleting = $state(false);
	// Reply box and reactions on other people's stories.
	let replyDraft = $state('');
	let replying = $state(false);
	let replyInput = $state<HTMLInputElement | null>(null);
	let sendingReply = $state(false);
	// Reactions sent in this viewer; anything else comes from `story.reaction`.
	let reactions = $state<Record<string, StoryReaction | null>>({});
	let dragY = $state(0);
	let video = $state<HTMLVideoElement | null>(null);

	let group = $derived(groups[gi]);
	let story = $derived(group?.stories[si]);
	let stopped = $derived(paused || held || confirmDelete || viewersOpen || replying);

	// Start on the requested group every time the viewer opens.
	$effect(() => {
		if (!open) return;
		// Only `open` should retrigger this; later changes to `groups` (a deletion) keep the position.
		untrack(() => {
			gi = Math.min(startIndex, Math.max(groups.length - 1, 0));
			si = 0;
			paused = false;
			held = false;
			dragY = 0;
		});
	});

	// A new story: restart its progress, record it as seen, warm up the next photo.
	$effect(() => {
		if (!open || !story) return;
		progress = 0;
		confirmDelete = false;
		viewersOpen = false;
		replyDraft = '';
		// The reply box may have unmounted with focus (your own story, or the viewer reopened).
		replying = document.activeElement === untrack(() => replyInput);
		const current = story;
		untrack(() => onSeen?.(current));
		const upcoming = group?.stories[si + 1] ?? groups[gi + 1]?.stories[0];
		if (upcoming?.mediaType === 'image') new Image().src = upcoming.mediaUrl;
	});

	// Photos advance on a timer; videos report progress from the element.
	$effect(() => {
		if (!open || !story || story.mediaType !== 'image' || stopped) return;
		let last = performance.now();
		let frame = requestAnimationFrame(function tick(now) {
			progress = Math.min(1, progress + (now - last) / IMAGE_DURATION_MS);
			last = now;
			if (progress >= 1) next();
			else frame = requestAnimationFrame(tick);
		});
		return () => cancelAnimationFrame(frame);
	});

	$effect(() => {
		if (!video) return;
		if (stopped) video.pause();
		else video.play().catch(() => {});
	});

	// Viewer emptied (e.g. you deleted your only story): close it.
	$effect(() => {
		if (open && !story) close();
	});

	function close() {
		open = false;
	}

	function next() {
		if (!group) return close();
		if (si < group.stories.length - 1) si += 1;
		else nextGroup();
	}

	function prev() {
		if (si > 0) si -= 1;
		else if (gi > 0) {
			gi -= 1;
			si = groups[gi].stories.length - 1;
		} else progress = 0;
	}

	function nextGroup() {
		if (gi < groups.length - 1) {
			gi += 1;
			si = 0;
		} else close();
	}

	function prevGroup() {
		if (gi > 0) {
			gi -= 1;
			si = 0;
		} else si = 0;
	}

	// Tap left third = back, elsewhere = forward; hold = pause; swipe sideways = next/previous
	// person; swipe down = close.
	let start = $state<{ x: number; y: number; at: number; width: number; left: number } | null>(
		null
	);
	let holdTimer: ReturnType<typeof setTimeout> | undefined;

	function onPointerDown(e: PointerEvent) {
		// Controls handle their own taps.
		if ((e.target as HTMLElement).closest('button, a, input')) return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		start = { x: e.clientX, y: e.clientY, at: Date.now(), width: rect.width, left: rect.left };
		holdTimer = setTimeout(() => (held = true), HOLD_MS);
	}

	function onPointerMove(e: PointerEvent) {
		if (!start) return;
		const dy = e.clientY - start.y;
		if (dy > 0 && Math.abs(dy) > Math.abs(e.clientX - start.x)) dragY = dy;
	}

	function onPointerUp(e: PointerEvent) {
		clearTimeout(holdTimer);
		if (!start) return;
		const dx = e.clientX - start.x;
		const dy = e.clientY - start.y;
		const wasHold = held || Date.now() - start.at >= HOLD_MS;
		const { width, left } = start;
		start = null;
		held = false;

		if (dy > CLOSE_DRAG_PX && Math.abs(dy) > Math.abs(dx)) return close();
		dragY = 0;
		if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
			return dx < 0 ? nextGroup() : prevGroup();
		}
		if (wasHold) return;
		if (e.clientX - left < width / 3) prev();
		else next();
	}

	function onPointerCancel() {
		clearTimeout(holdTimer);
		start = null;
		held = false;
		dragY = 0;
	}

	function onKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		// Keys in the viewers list or the delete confirmation belong to those dialogs, and typing a
		// reply must not navigate or pause.
		if (target.closest('dialog') !== e.currentTarget || target.closest('input')) return;
		if (e.key === 'ArrowRight') next();
		else if (e.key === 'ArrowLeft') prev();
		else if (e.key === ' ' && !target.closest('button')) {
			e.preventDefault();
			paused = !paused;
		}
	}

	function onVideoTime() {
		if (video?.duration) progress = video.currentTime / video.duration;
	}

	async function deleteStory() {
		if (!story || deleting) return;
		const target = story;
		deleting = true;
		try {
			const res = await fetch(`/api/stories/${encodeURIComponent(target.id)}`, {
				method: 'DELETE'
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				toast.show(readApiError(body, 'Could not delete this story').message);
				return;
			}
			toast.show('Story deleted');
			// The parent removes it from `groups`; stay on the same position (now the next story).
			if (si > 0 && si >= group.stories.length - 1) si -= 1;
			onDeleted?.(target);
		} catch {
			toast.show('Could not delete this story');
		} finally {
			deleting = false;
			confirmDelete = false;
		}
	}

	/** One page of a story's viewers, or the message to show when it could not be loaded. */
	async function fetchViewers(
		storyId: string,
		cursor: string | null
	): Promise<ViewersPage | string> {
		const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
		try {
			const res = await fetch(`/api/stories/${encodeURIComponent(storyId)}/views${query}`);
			const body = await res.json().catch(() => null);
			return res.ok ? (body as ViewersPage) : readApiError(body, 'Could not load viewers').message;
		} catch {
			return 'Could not load viewers';
		}
	}

	/** Shows a loaded page if the viewer is still on `target`; keeps the button's count in step. */
	function applyViewers(target: Story, page: ViewersPage) {
		if (story?.id !== target.id) return;
		viewers = [...viewers, ...page.viewers];
		viewersCount = page.count;
		viewersCursor = page.nextCursor;
		target.viewCount = page.count;
	}

	async function openViewers() {
		if (!story) return;
		const target = story;
		viewersOpen = true;
		viewersLoading = true;
		viewers = [];
		viewersCursor = null;
		viewersMoreError = null;
		const page = await fetchViewers(target.id, null);
		viewersLoading = false;
		if (typeof page === 'string') {
			toast.show(page);
			viewersOpen = false;
			return;
		}
		applyViewers(target, page);
	}

	async function loadMoreViewers() {
		if (!story || !viewersCursor || viewersMoreLoading) return;
		const target = story;
		viewersMoreLoading = true;
		viewersMoreError = null;
		const page = await fetchViewers(target.id, viewersCursor);
		viewersMoreLoading = false;
		if (typeof page === 'string') viewersMoreError = page;
		else applyViewers(target, page);
	}

	const followStatusOf = (person: StoryViewer) =>
		followStore.status(person.id, person.isFollowing ? 'following' : 'none');

	async function toggleFollowViewer(person: StoryViewer) {
		try {
			await followStore.set(person.id, followStatusOf(person) === 'none');
		} catch (err) {
			toast.show(err instanceof Error ? err.message : 'Could not update follow');
		}
	}

	async function react(emoji: StoryReaction) {
		if (!story) return;
		const target = story;
		const previous = reactionOf(target);
		const next = previous === emoji ? null : emoji;
		reactions[target.id] = next;
		try {
			const res = await fetch(`/api/stories/${encodeURIComponent(target.id)}/react`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ reaction: next })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(readApiError(body, 'Could not send your reaction').message);
			}
		} catch (err) {
			reactions[target.id] = previous;
			toast.show(err instanceof Error ? err.message : 'Could not send your reaction');
		}
	}

	function reactionOf(s: Story): StoryReaction | null {
		return s.id in reactions ? reactions[s.id] : (s.reaction ?? null);
	}

	async function sendReply(e: SubmitEvent) {
		e.preventDefault();
		const content = replyDraft.trim();
		if (!story || !content || sendingReply) return;
		sendingReply = true;
		try {
			const res = await fetch(`/api/stories/${encodeURIComponent(story.id)}/reply`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ content })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				toast.show(readApiError(body, 'Could not send your reply').message);
				return;
			}
			replyDraft = '';
			toast.show('Reply sent');
		} catch {
			toast.show('Could not send your reply');
		} finally {
			sendingReply = false;
		}
	}

	function segmentWidth(index: number) {
		if (index < si) return 100;
		if (index > si) return 0;
		return progress * 100;
	}
</script>

{#if group && story}
	<Modal
		bind:open
		label={`Stories from ${group.user.name}`}
		variant="fullscreen"
		closeOnBackdrop={false}
		class="items-center justify-center bg-slate-50/95 dark:bg-dark-canvas/95 backdrop-blur-md select-none"
		onkeydown={onKeydown}
	>
		<!-- Desktop: previous / next person, outside the frame -->
		<button
			type="button"
			class="hidden sm:flex absolute left-[max(1rem,calc(50%-19rem))] top-1/2 -translate-y-1/2 size-11 rounded-full bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 shadow-md dark:bg-dark-elevated dark:hover:bg-dark-hover dark:text-dark-text dark:border-dark-border items-center justify-center cursor-pointer transition disabled:opacity-0"
			onclick={prev}
			disabled={gi === 0 && si === 0}
			aria-label="Previous story"
		>
			<Icon name="angle-left" />
		</button>
		<button
			type="button"
			class="hidden sm:flex absolute right-[max(1rem,calc(50%-19rem))] top-1/2 -translate-y-1/2 size-11 rounded-full bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 shadow-md dark:bg-dark-elevated dark:hover:bg-dark-hover dark:text-dark-text dark:border-dark-border items-center justify-center cursor-pointer transition"
			onclick={next}
			aria-label="Next story"
		>
			<Icon name="angle-right" />
		</button>

		<!-- 9:16 frame: full screen on phones, centered card on larger screens -->
		<div
			class="relative w-full h-full sm:h-[min(92dvh,56rem)] sm:w-auto sm:aspect-9/16 sm:rounded-3xl overflow-hidden bg-white dark:bg-dark-card sm:border sm:border-slate-200 sm:dark:border-dark-border sm:shadow-2xl touch-none"
			style:transform={dragY
				? `translateY(${dragY}px) scale(${1 - Math.min(dragY, 300) / 1500})`
				: undefined}
			style:transition={start ? 'none' : 'transform 0.2s ease'}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerCancel}
			role="presentation"
		>
			{#key story.id}
				{#if story.mediaType === 'video'}
					<video
						bind:this={video}
						src={story.mediaUrl}
						class="absolute inset-0 w-full h-full object-cover"
						playsinline
						autoplay
						{muted}
						preload="auto"
						ontimeupdate={onVideoTime}
						onended={next}
					></video>
				{:else}
					<img
						src={story.mediaUrl}
						alt={story.caption || `Story from ${group.user.name}`}
						class="absolute inset-0 w-full h-full object-cover"
						draggable="false"
					/>
				{/if}
			{/key}

			<!-- Readability scrims -->
			<div
				class="pointer-events-none absolute inset-x-0 top-0 h-32 bg-linear-to-b from-black/60 to-transparent"
			></div>
			<div
				class="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-black/60 to-transparent"
			></div>

			<!-- Progress: one segment per story from this person -->
			<div
				class="absolute top-0 inset-x-0 flex gap-1 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
			>
				{#each group.stories as s, index (s.id)}
					<div class="h-0.75 flex-1 rounded-full bg-white/35 overflow-hidden">
						<div
							class="h-full bg-white rounded-full"
							style:width={`${segmentWidth(index)}%`}
							data-testid="story-progress"
						></div>
					</div>
				{/each}
			</div>

			<!-- Header -->
			<div
				class="absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-3 pt-[max(1.5rem,calc(env(safe-area-inset-top)+0.75rem))]"
			>
				<a
					href={group.isSelf
						? resolve('/profile')
						: resolve('/profile/[id]', { id: group.user.id })}
					class="flex items-center gap-2.5 min-w-0 no-underline text-white"
				>
					<!-- White ring hugging the avatar; sits on the dark scrim, so it reads in both themes -->
					<span class="size-10 shrink-0 rounded-full p-[2px] bg-white shadow-sm">
						<Avatar src={group.user.image} name={group.user.name} size="md" class="!size-full" />
					</span>
					<span class="flex flex-col min-w-0 leading-tight">
						<span class="flex items-center gap-1.5 text-sm font-semibold drop-shadow">
							<span class="truncate">{group.isSelf ? 'Your story' : group.user.name}</span>
							<span class="text-xs font-normal text-white/75 shrink-0">
								· {formatTimeAgo(story.createdAt)}
							</span>
						</span>
						{#if story.audience === 'close_friends'}
							<span
								class="self-start mt-0.5 px-1.5 py-px rounded-full bg-green-500 text-white text-[10px] font-semibold"
							>
								Close friends
							</span>
						{/if}
						{#if story.location}
							<span class="flex items-center gap-1 text-[11px] text-white/80 truncate">
								<Icon name="map-marker" class="text-[10px]" />
								<span class="truncate">{story.location}</span>
							</span>
						{/if}
					</span>
				</a>

				<div class="flex items-center gap-1 shrink-0 text-white">
					{#if story.mediaType === 'video'}
						<button
							type="button"
							class="size-10 rounded-full flex items-center justify-center bg-transparent hover:bg-white/15 border-0 cursor-pointer text-white"
							onclick={() => (muted = !muted)}
							aria-label={muted ? 'Unmute' : 'Mute'}
						>
							<Icon name={muted ? 'volume-mute' : 'volume'} />
						</button>
					{/if}
					<button
						type="button"
						class="size-10 rounded-full flex items-center justify-center bg-transparent hover:bg-white/15 border-0 cursor-pointer text-white"
						onclick={() => (paused = !paused)}
						aria-label={paused ? 'Play' : 'Pause'}
					>
						<Icon name={paused ? 'play' : 'pause'} />
					</button>
					{#if group.isSelf}
						<button
							type="button"
							class="size-10 rounded-full flex items-center justify-center bg-transparent hover:bg-white/15 border-0 cursor-pointer text-white"
							onclick={() => (confirmDelete = true)}
							aria-label="Delete story"
						>
							<Icon name="trash" />
						</button>
					{/if}
					<!-- svelte-ignore a11y_autofocus (the viewer is a modal dialog, which focuses it on open) -->
					<button
						autofocus
						type="button"
						class="size-10 rounded-full flex items-center justify-center bg-transparent hover:bg-white/15 border-0 cursor-pointer text-white"
						onclick={close}
						aria-label="Close stories"
					>
						<Icon name="cross" />
					</button>
				</div>
			</div>

			<!-- Bottom: caption card, then the viewers button (own story) or reactions and reply -->
			<div
				class="absolute inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-2"
			>
				{#if story.caption}
					<div class="rounded-2xl bg-black/45 backdrop-blur-md px-4 py-3 text-white">
						{#if story.location}
							<p
								class="flex items-center gap-1.5 m-0 mb-1 text-[10px] font-semibold tracking-widest uppercase text-white/70"
							>
								<span class="size-1.5 rounded-full bg-kizuna-blue"></span>
								{story.location}
							</p>
						{/if}
						<p class="m-0 text-sm leading-relaxed">{story.caption}</p>
					</div>
				{/if}
				{#if group.isSelf}
					<button
						type="button"
						class="self-start flex items-center gap-2 h-9 px-3.5 rounded-full bg-black/45 hover:bg-black/60 backdrop-blur-md text-white text-xs font-semibold border-0 cursor-pointer"
						onclick={openViewers}
						aria-label={`${story.viewCount ?? 0} ${story.viewCount === 1 ? 'view' : 'views'}, see who viewed`}
					>
						<Icon name="eye" class="text-sm" />
						<span>{story.viewCount ?? 0} {story.viewCount === 1 ? 'view' : 'views'}</span>
					</button>
				{:else}
					{@const mine = reactionOf(story)}
					<div class="flex items-center justify-between gap-1" role="group" aria-label="React">
						{#each STORY_REACTIONS as emoji (emoji)}
							<button
								type="button"
								class="size-10 rounded-full flex items-center justify-center text-xl border-0 cursor-pointer transition active:scale-90 {mine ===
								emoji
									? 'bg-white/35 scale-110'
									: 'bg-black/30 hover:bg-black/45'}"
								aria-label={`React ${emoji}`}
								aria-pressed={mine === emoji}
								onclick={() => react(emoji)}
							>
								{emoji}
							</button>
						{/each}
					</div>
					<form class="flex items-center gap-2" onsubmit={sendReply}>
						<input
							bind:this={replyInput}
							bind:value={replyDraft}
							type="text"
							maxlength={MAX_MESSAGE_LENGTH}
							placeholder={`Reply to ${group.user.name}…`}
							aria-label={`Reply to ${group.user.name}`}
							class="flex-1 min-w-0 h-11 px-4 rounded-full bg-black/30 border border-white/50 text-sm text-white placeholder:text-white/70 focus:outline-none focus:border-white"
							onfocus={() => (replying = true)}
							onblur={() => (replying = false)}
						/>
						{#if replyDraft.trim()}
							<button
								type="submit"
								class="shrink-0 h-11 px-4 rounded-full bg-white text-slate-950 text-sm font-semibold border-0 cursor-pointer disabled:opacity-50"
								disabled={sendingReply}
							>
								Send
							</button>
						{/if}
					</form>
				{/if}
			</div>
		</div>

		<!-- Own stories: who viewed it, and the delete confirmation -->
		<BottomSheet bind:open={viewersOpen} title="Story viewers">
			<h2 class="m-0 px-3 pt-1 pb-2 text-sm font-semibold flex items-center gap-2">
				<Icon name="eye" class="text-sm text-slate-500 dark:text-dark-muted" />
				<span
					>{viewersLoading
						? 'Viewers'
						: `${viewersCount} ${viewersCount === 1 ? 'viewer' : 'viewers'}`}</span
				>
			</h2>
			<ul class="list-none m-0 p-0">
				{#if viewersLoading}
					{#each [0, 1, 2] as i (i)}
						<li class="flex items-center gap-3 px-3 py-2" aria-hidden="true">
							<div
								class="size-10 rounded-full bg-slate-100 dark:bg-dark-elevated animate-pulse"
							></div>
							<div
								class="h-3 w-32 rounded-full bg-slate-100 dark:bg-dark-elevated animate-pulse"
							></div>
						</li>
					{/each}
				{:else if viewers.length === 0}
					<li class="px-3 py-8 text-center text-xs text-slate-500 dark:text-dark-muted">
						No one has viewed this story yet.
					</li>
				{:else}
					{#each viewers as person (person.id)}
						{@const status = followStatusOf(person)}
						<li class="flex items-center gap-3 px-3 py-2 rounded-2xl">
							<a
								href={resolve('/profile/[id]', { id: person.id })}
								class="flex items-center gap-3 min-w-0 flex-1 no-underline text-inherit"
							>
								<Avatar src={person.image} name={person.name} size="md" />
								<span class="flex flex-col min-w-0 leading-tight">
									<span class="text-sm font-semibold truncate">{person.name}</span>
									<span class="text-xs text-slate-500 dark:text-dark-muted truncate">
										{person.handle ? `@${person.handle} · ` : ''}{formatTimeAgo(person.viewedAt)}
									</span>
								</span>
							</a>
							{#if person.reaction}
								<span class="shrink-0 text-xl" aria-label={`Reacted ${person.reaction}`}
									>{person.reaction}</span
								>
							{/if}
							<button
								type="button"
								class="shrink-0 h-8 px-4 rounded-full text-xs font-semibold border-0 cursor-pointer transition {status !==
								'none'
									? 'bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text'
									: 'bg-blue-600 dark:bg-kizuna-blue text-white'}"
								aria-pressed={status !== 'none'}
								onclick={() => toggleFollowViewer(person)}
							>
								{FOLLOW_LABELS[status]}
							</button>
						</li>
					{/each}
				{/if}
			</ul>
			{#if viewersCursor}
				<LoadMore onLoad={loadMoreViewers} loading={viewersMoreLoading} error={viewersMoreError} />
			{/if}
		</BottomSheet>

		<BottomSheet bind:open={confirmDelete} title="Delete this story?" showTitle>
			<p class="px-3 pb-2 text-sm text-slate-600 dark:text-dark-muted">
				It will disappear for everyone right away.
			</p>
			{#snippet footer()}
				<div class="flex justify-end gap-2">
					<button
						type="button"
						class="h-10 px-4 rounded-full text-sm font-semibold bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text border-0 cursor-pointer hover:bg-slate-200 dark:hover:bg-dark-hover"
						onclick={() => (confirmDelete = false)}
					>
						Cancel
					</button>
					<button
						type="button"
						class="h-10 px-5 rounded-full text-sm font-semibold bg-red-600 text-white border-0 cursor-pointer hover:bg-red-700 disabled:opacity-50 disabled:cursor-default"
						disabled={deleting}
						onclick={deleteStory}
					>
						{deleting ? 'Deleting…' : 'Delete'}
					</button>
				</div>
			{/snippet}
		</BottomSheet>
	</Modal>
{/if}
