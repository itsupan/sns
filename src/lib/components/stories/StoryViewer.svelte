<script lang="ts">
	import { untrack } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { resolve } from '$app/paths';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { formatTimeAgo } from '$lib/utils/format';
	import { toast } from '$lib/utils/toast.svelte';
	import { readApiError } from '$lib/utils/api-error';
	import { followStore } from '$lib/utils/follow.svelte';
	import type { Story, StoryGroup } from './stories.svelte';

	interface StoryViewer {
		id: string;
		name: string;
		handle: string | null;
		image: string | null;
		viewedAt: number;
		isFollowing: boolean;
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
	let deleting = $state(false);
	let dragY = $state(0);
	let video = $state<HTMLVideoElement | null>(null);
	let closeButton = $state<HTMLButtonElement | null>(null);

	let group = $derived(groups[gi]);
	let story = $derived(group?.stories[si]);
	let stopped = $derived(paused || held || confirmDelete || viewersOpen);

	// Start on the requested group every time the viewer opens.
	$effect(() => {
		if (!open) return;
		// Only `open` should retrigger this; later changes to `groups` (a deletion) keep the position.
		untrack(() => {
			gi = Math.min(startIndex, Math.max(groups.length - 1, 0));
			si = 0;
			paused = false;
		});
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		queueMicrotask(() => closeButton?.focus());
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	});

	// A new story: restart its progress, record it as seen, warm up the next photo.
	$effect(() => {
		if (!open || !story) return;
		progress = 0;
		confirmDelete = false;
		viewersOpen = false;
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
		dragY = 0;
		held = false;
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
		// Controls and overlays (viewers list, delete confirmation) handle their own taps.
		if ((e.target as HTMLElement).closest('button, a, input, [data-no-nav]')) return;
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
		if (!open) return;
		if (e.key === 'Escape') close();
		else if (e.key === 'ArrowRight') next();
		else if (e.key === 'ArrowLeft') prev();
		else if (e.key === ' ' && !(e.target as HTMLElement).closest('button')) {
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

	async function openViewers() {
		if (!story) return;
		const target = story;
		viewersOpen = true;
		viewersLoading = true;
		viewers = [];
		try {
			const res = await fetch(`/api/stories/${encodeURIComponent(target.id)}/views`);
			const body = (await res.json().catch(() => null)) as {
				viewers?: StoryViewer[];
			} | null;
			if (!res.ok) {
				toast.show(readApiError(body, 'Could not load viewers').message);
				viewersOpen = false;
				return;
			}
			if (story?.id === target.id) {
				viewers = body?.viewers ?? [];
				// Keep the count on the button in step with the list.
				target.viewCount = viewers.length;
			}
		} catch {
			toast.show('Could not load viewers');
			viewersOpen = false;
		} finally {
			viewersLoading = false;
		}
	}

	async function toggleFollowViewer(person: StoryViewer) {
		const next = !followStore.isFollowing(person.id, person.isFollowing);
		try {
			await followStore.set(person.id, next);
		} catch (err) {
			toast.show(err instanceof Error ? err.message : 'Could not update follow');
		}
	}

	function segmentWidth(index: number) {
		if (index < si) return 100;
		if (index > si) return 0;
		return progress * 100;
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if open && group && story}
	<div
		class="fixed inset-0 z-90 bg-slate-50/95 dark:bg-dark-canvas/95 backdrop-blur-md flex items-center justify-center select-none"
		role="dialog"
		aria-modal="true"
		aria-label={`Stories from ${group.user.name}`}
		transition:fade={{ duration: 150 }}
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
						{#if story.location}
							<span class="flex items-center gap-1 text-[11px] text-white/80 truncate">
								<Icon name="marker" class="text-[10px]" />
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
					<button
						bind:this={closeButton}
						type="button"
						class="size-10 rounded-full flex items-center justify-center bg-transparent hover:bg-white/15 border-0 cursor-pointer text-white"
						onclick={close}
						aria-label="Close stories"
					>
						<Icon name="cross" />
					</button>
				</div>
			</div>

			<!-- Bottom: caption card, and on your own story the viewers button -->
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
						aria-label={`${story.viewCount ?? 0} views, see who viewed`}
					>
						<Icon name="eye" class="text-sm" />
						<span>{story.viewCount ?? 0} {story.viewCount === 1 ? 'view' : 'views'}</span>
					</button>
				{/if}
			</div>

			<!-- Viewers panel (own stories) -->
			{#if viewersOpen}
				<div class="absolute inset-0 bg-black/40" data-no-nav transition:fade={{ duration: 120 }}>
					<button
						type="button"
						class="absolute inset-0 size-full bg-transparent border-0 cursor-default"
						aria-label="Close viewers"
						onclick={() => (viewersOpen = false)}
					></button>
					<div
						class="absolute inset-x-0 bottom-0 max-h-[70%] flex flex-col rounded-t-3xl bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text shadow-2xl"
						role="dialog"
						aria-label="Story viewers"
						transition:fly={{ y: 300, duration: 200 }}
					>
						<div
							class="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 dark:border-dark-border"
						>
							<h2 class="m-0 text-sm font-semibold flex items-center gap-2">
								<Icon name="eye" class="text-sm text-slate-500 dark:text-dark-muted" />
								<span>{viewersLoading ? 'Viewers' : `${viewers.length} viewers`}</span>
							</h2>
							<button
								type="button"
								class="size-8 rounded-full flex items-center justify-center bg-transparent hover:bg-slate-100 dark:hover:bg-dark-hover border-0 cursor-pointer text-slate-500 dark:text-dark-muted"
								onclick={() => (viewersOpen = false)}
								aria-label="Close viewers"
							>
								<Icon name="cross" class="text-xs" />
							</button>
						</div>
						<ul class="flex-1 overflow-y-auto list-none m-0 px-2 py-2">
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
									{@const following = followStore.isFollowing(person.id, person.isFollowing)}
									<li class="flex items-center gap-3 px-3 py-2 rounded-2xl">
										<a
											href={resolve('/profile/[id]', { id: person.id })}
											class="flex items-center gap-3 min-w-0 flex-1 no-underline text-inherit"
										>
											<Avatar src={person.image} name={person.name} size="md" />
											<span class="flex flex-col min-w-0 leading-tight">
												<span class="text-sm font-semibold truncate">{person.name}</span>
												<span class="text-xs text-slate-500 dark:text-dark-muted truncate">
													{person.handle ? `@${person.handle} · ` : ''}{formatTimeAgo(
														person.viewedAt
													)}
												</span>
											</span>
										</a>
										<button
											type="button"
											class="shrink-0 h-8 px-4 rounded-full text-xs font-semibold border-0 cursor-pointer transition {following
												? 'bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text'
												: 'bg-blue-600 dark:bg-kizuna-blue text-white'}"
											aria-pressed={following}
											onclick={() => toggleFollowViewer(person)}
										>
											{following ? 'Following' : 'Follow'}
										</button>
									</li>
								{/each}
							{/if}
						</ul>
					</div>
				</div>
			{/if}

			<!-- Delete confirmation (own stories) -->
			{#if confirmDelete}
				<div
					class="absolute inset-0 bg-black/60 flex items-end sm:items-center justify-center p-4"
					data-no-nav
					transition:fade={{ duration: 120 }}
				>
					<div class="w-full max-w-xs rounded-2xl bg-white dark:bg-dark-card p-4 text-center">
						<p class="m-0 mb-1 text-sm font-semibold text-slate-950 dark:text-white">
							Delete this story?
						</p>
						<p class="m-0 mb-4 text-xs text-slate-500 dark:text-dark-muted">
							It will disappear for everyone right away.
						</p>
						<div class="flex gap-2">
							<button
								type="button"
								class="flex-1 h-10 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text text-xs font-semibold border-0 cursor-pointer"
								onclick={() => (confirmDelete = false)}
							>
								Cancel
							</button>
							<button
								type="button"
								class="flex-1 h-10 rounded-full bg-red-600 text-white text-xs font-semibold border-0 cursor-pointer disabled:opacity-50"
								onclick={deleteStory}
								disabled={deleting}
							>
								{deleting ? 'Deleting…' : 'Delete'}
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
