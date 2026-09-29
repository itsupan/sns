<script lang="ts" module>
	import type { ReactionSummary } from '$lib/reactions';

	/** A comment as returned by `/api/posts/:id/comments` and `/api/comments/:id/replies`. */
	export interface CommentItem {
		id: string;
		postId?: string;
		parentCommentId: string | null;
		content: string;
		createdAt: string | Date;
		timeAgo: string;
		repliesCount: number;
		reactions: ReactionSummary;
		canDelete: boolean;
		author: { id: string; name: string; handle: string; avatar: string };
		/** Built from the post's comment preview when the API is unavailable; read-only. */
		preview?: boolean;
	}

	interface Page {
		comments: CommentItem[];
		nextCursor: string | null;
	}

	/** One list of comments: the post's top-level comments, or one comment's replies. */
	interface Thread {
		/** Pages fetched from the server, in order. */
		items: CommentItem[];
		/** Comments the viewer added that are not in `items` yet (shown after them). */
		sent: CommentItem[];
		nextCursor: string | null;
		/** At least one page was fetched. */
		loaded: boolean;
		loading: boolean;
		open: boolean;
	}

	const newThread = (): Thread => ({
		items: [],
		sent: [],
		nextCursor: null,
		loaded: false,
		loading: false,
		open: false
	});

	function visible(thread: Thread): CommentItem[] {
		const ids = new Set(thread.items.map((c) => c.id));
		return [...thread.items, ...thread.sent.filter((c) => !ids.has(c.id))];
	}
</script>

<script lang="ts">
	import { readApiError } from '$lib/utils/api-error';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { authClient } from '$lib/auth-client';
	import { toast } from '$lib/utils/toast.svelte';
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		COMMENT_REACTIONS,
		REACTION_EMOJI,
		REACTION_LABEL,
		type CommentReaction
	} from '$lib/reactions';
	import type { PostData, PostComment } from './PostCard.svelte';

	interface Props {
		open?: boolean;
		post: PostData;
		onCommentAdded?: (comment: PostComment, newCount: number) => void;
		/** A comment (and its replies) was deleted; `newCount` is the post's new total. */
		onCommentDeleted?: (commentId: string, newCount: number) => void;
	}

	let { open = $bindable(false), post, onCommentAdded, onCommentDeleted }: Props = $props();

	const session = authClient.useSession();

	/** Top-level comments. */
	let top = $state<Thread>(newThread());
	/** Replies keyed by top-level comment id. */
	let replies = $state<Record<string, Thread>>({});
	let loadError = $state<string | null>(null);
	let submitting = $state(false);
	let commentText = $state('');
	/** The comment being answered; replies always attach to its top-level comment. */
	let replyingTo = $state<CommentItem | null>(null);
	let pickerFor = $state<string | null>(null);
	let confirmingDelete = $state<string | null>(null);
	let deleting = $state<string | null>(null);
	/** Post total after this modal changed it; `null` until then. */
	let totalOverride = $state<number | null>(null);
	let inputElement = $state<HTMLInputElement | null>(null);
	/** Latest reaction request per comment, so an older response never overwrites a newer tap. */
	const reactionSeq: Record<string, number> = {};

	let total = $derived(totalOverride ?? post.commentsCount);
	let viewerId = $derived(($session.data?.user as { id?: string } | undefined)?.id ?? '');
	let currentUser = $derived({
		name: $session.data?.user?.name || '',
		image: $session.data?.user?.image || ''
	});

	function close() {
		open = false;
		replyingTo = null;
		pickerFor = null;
		confirmingDelete = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !open) return;
		if (pickerFor) pickerFor = null;
		else close();
	}

	const isPostAuthor = (c: CommentItem) => !!post.author.id && c.author.id === post.author.id;
	const isMine = (c: CommentItem) => !!viewerId && c.author.id === viewerId;

	/** Finds the comment in whichever thread holds it. */
	function findComment(id: string): CommentItem | undefined {
		for (const thread of [top, ...Object.values(replies)]) {
			const found = thread.items.find((c) => c.id === id) ?? thread.sent.find((c) => c.id === id);
			if (found) return found;
		}
	}

	async function requireSignIn(message: string): Promise<boolean> {
		if ($session.data?.user) return true;
		toast.show(message);
		const currentPath =
			typeof window !== 'undefined'
				? window.location.pathname + window.location.search
				: resolve('/');
		try {
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto(`${resolve('/login')}?redirectTo=${encodeURIComponent(currentPath)}`);
		} catch {
			// Router not mounted
		}
		return false;
	}

	async function fetchPage(url: string): Promise<Page> {
		const res = await fetch(url);
		const data = await res.json().catch(() => null);
		if (!res.ok) throw new Error(readApiError(data, 'Could not load comments').message);
		return data as Page;
	}

	function previewFallback(): CommentItem[] {
		if (!post.commentPreview) return [];
		return [
			{
				id: 'preview-1',
				parentCommentId: null,
				content: post.commentPreview.content,
				createdAt: new Date(),
				timeAgo: 'Recently',
				repliesCount: 0,
				reactions: { counts: {}, mine: [] },
				canDelete: false,
				author: {
					id: '',
					name: post.commentPreview.author,
					handle: `@${post.commentPreview.author.replace(/^@/, '')}`,
					avatar: ''
				},
				preview: true
			}
		];
	}

	/** Loads the next page of top-level comments; `reset` starts over (e.g. on reopen). */
	async function loadTop(reset = false) {
		if (reset) {
			top = newThread();
			replies = {};
		} else if (top.loading) {
			return;
		}
		// Writes go to this thread object, so a response that lands after a reset is dropped.
		const thread = top;
		thread.loading = true;
		loadError = null;
		const cursor = thread.nextCursor ? `?cursor=${encodeURIComponent(thread.nextCursor)}` : '';
		try {
			const page = await fetchPage(`/api/posts/${post.id}/comments${cursor}`);
			thread.items = [...thread.items, ...page.comments];
			thread.nextCursor = page.nextCursor;
			thread.loaded = true;
		} catch (err) {
			if (thread !== top) return;
			if (!thread.loaded && post.commentPreview) {
				thread.items = previewFallback();
				thread.loaded = true;
			} else {
				loadError = err instanceof Error ? err.message : 'Could not load comments';
			}
		} finally {
			thread.loading = false;
		}
	}

	function threadFor(parentId: string): Thread {
		replies[parentId] ??= newThread();
		return replies[parentId];
	}

	async function loadReplies(parentId: string) {
		const thread = threadFor(parentId);
		if (thread.loading) return;
		thread.open = true;
		thread.loading = true;
		const cursor = thread.nextCursor ? `?cursor=${encodeURIComponent(thread.nextCursor)}` : '';
		try {
			const page = await fetchPage(`/api/comments/${parentId}/replies${cursor}`);
			thread.items = [...thread.items, ...page.comments];
			thread.nextCursor = page.nextCursor;
			thread.loaded = true;
		} catch (err) {
			toast.show(err instanceof Error ? err.message : 'Could not load replies');
		} finally {
			thread.loading = false;
		}
	}

	/** Replies not fetched yet: the parent's count minus what the open thread shows. */
	function moreReplies(parent: CommentItem, thread: Thread): number {
		if (thread.loaded && !thread.nextCursor) return 0;
		return Math.max(0, parent.repliesCount - visible(thread).length);
	}

	function showReplies(parentId: string) {
		const thread = threadFor(parentId);
		if (thread.loaded) thread.open = true;
		else loadReplies(parentId);
	}

	$effect(() => {
		if (open) untrack(() => loadTop(true));
	});

	function startReply(target: CommentItem) {
		replyingTo = target;
		const handlePrefix = `${target.author.handle.startsWith('@') ? '' : '@'}${target.author.handle} `;
		if (!commentText.includes(handlePrefix)) commentText = `${handlePrefix}${commentText}`;
		setTimeout(() => inputElement?.focus(), 50);
	}

	function cancelReply() {
		if (!replyingTo) return;
		const handlePrefix = `${replyingTo.author.handle.startsWith('@') ? '' : '@'}${replyingTo.author.handle} `;
		if (commentText.startsWith(handlePrefix)) commentText = commentText.slice(handlePrefix.length);
		replyingTo = null;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = commentText.trim();
		if (!trimmed || submitting) return;
		if (!(await requireSignIn('Please log in to add comments'))) return;

		submitting = true;
		const parentId = replyingTo ? (replyingTo.parentCommentId ?? replyingTo.id) : null;
		try {
			const res = await fetch(`/api/posts/${post.id}/comments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: trimmed, parentCommentId: parentId })
			});
			const data = await res.json().catch(() => null);
			if (!res.ok) throw new Error(readApiError(data, 'Failed to post comment').message);

			const created = data as {
				comment: CommentItem;
				commentsCount: number;
				repliesCount: number | null;
			};
			if (parentId) {
				const thread = threadFor(parentId);
				thread.sent = [...thread.sent, created.comment];
				thread.open = true;
				const parent = findComment(parentId);
				if (parent && created.repliesCount !== null) parent.repliesCount = created.repliesCount;
			} else if (top.nextCursor) {
				top.sent = [...top.sent, created.comment];
			} else {
				top.items = [...top.items, created.comment];
			}
			totalOverride = created.commentsCount;
			commentText = '';
			replyingTo = null;
			toast.show(parentId ? 'Reply posted' : 'Comment posted');

			onCommentAdded?.(
				{
					id: created.comment.id,
					author: created.comment.author.handle || created.comment.author.name,
					content: created.comment.content
				},
				created.commentsCount
			);
		} catch (err) {
			toast.show(err instanceof Error ? err.message : 'Could not post comment');
		} finally {
			submitting = false;
		}
	}

	/** Summary after the viewer toggles `type`, computed locally for an instant update. */
	function toggled(summary: ReactionSummary, type: CommentReaction): ReactionSummary {
		const had = summary.mine.includes(type);
		const next = Math.max(0, (summary.counts[type] ?? 0) + (had ? -1 : 1));
		const counts = { ...summary.counts };
		if (next > 0) counts[type] = next;
		else delete counts[type];
		const mine = had
			? summary.mine.filter((t) => t !== type)
			: COMMENT_REACTIONS.filter((t) => t === type || summary.mine.includes(t));
		return { counts, mine };
	}

	async function react(comment: CommentItem, type: CommentReaction) {
		pickerFor = null;
		if (!(await requireSignIn('Please log in to react to comments'))) return;

		const before = comment.reactions;
		comment.reactions = toggled(before, type);
		navigator.vibrate?.(10);
		const seq = (reactionSeq[comment.id] = (reactionSeq[comment.id] ?? 0) + 1);
		try {
			const res = await fetch(`/api/comments/${comment.id}/reactions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type })
			});
			const data = await res.json().catch(() => null);
			if (!res.ok) throw new Error(readApiError(data, 'Could not save your reaction').message);
			if (seq === reactionSeq[comment.id]) {
				comment.reactions = (data as { reactions: ReactionSummary }).reactions;
			}
		} catch (err) {
			if (seq === reactionSeq[comment.id]) comment.reactions = before;
			toast.show(err instanceof Error ? err.message : 'Could not save your reaction');
		}
	}

	async function remove(comment: CommentItem) {
		if (confirmingDelete !== comment.id) {
			confirmingDelete = comment.id;
			return;
		}
		confirmingDelete = null;
		deleting = comment.id;
		try {
			const res = await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' });
			const data = await res.json().catch(() => null);
			if (!res.ok) throw new Error(readApiError(data, 'Could not delete the comment').message);
			const result = data as { commentsCount: number; repliesCount: number | null };

			const drop = (t: Thread) => {
				t.items = t.items.filter((c) => c.id !== comment.id);
				t.sent = t.sent.filter((c) => c.id !== comment.id);
			};
			if (comment.parentCommentId) {
				const thread = replies[comment.parentCommentId];
				if (thread) drop(thread);
				const parent = findComment(comment.parentCommentId);
				if (parent && result.repliesCount !== null) parent.repliesCount = result.repliesCount;
			} else {
				drop(top);
				delete replies[comment.id];
			}
			if (
				replyingTo &&
				(replyingTo.id === comment.id || replyingTo.parentCommentId === comment.id)
			) {
				cancelReply();
			}
			totalOverride = result.commentsCount;
			toast.show('Comment deleted');
			onCommentDeleted?.(comment.id, result.commentsCount);
		} catch (err) {
			toast.show(err instanceof Error ? err.message : 'Could not delete the comment');
		} finally {
			deleting = null;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet commentRow(comment: CommentItem)}
	{@const reactionTypes = COMMENT_REACTIONS.filter((t) => comment.reactions.counts[t])}
	<div class="flex items-start gap-3 group" data-testid="comment-{comment.id}">
		<Avatar
			src={comment.author.avatar}
			name={comment.author.name}
			size={comment.parentCommentId ? 'xs' : 'sm'}
		/>
		<div class="flex flex-col min-w-0 flex-1">
			<div class="flex items-center gap-1.5 flex-wrap leading-tight">
				<span class="text-xs font-semibold text-slate-900 dark:text-dark-text truncate">
					{comment.author.name}
				</span>
				{#if isPostAuthor(comment)}
					<span
						class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-950 text-[9px] font-bold tracking-wider uppercase shadow-2xs"
						title="Post Creator"
					>
						Author
					</span>
				{:else if isMine(comment)}
					<span
						class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-muted text-[9px] font-medium border border-slate-200 dark:border-dark-border"
					>
						You
					</span>
				{/if}
				<span class="text-[11px] text-slate-400 dark:text-dark-muted ml-auto sm:ml-1">
					{comment.timeAgo}
				</span>
			</div>

			<p
				class="text-xs leading-relaxed text-slate-700 dark:text-dark-muted mt-1 m-0 break-words whitespace-pre-line"
			>
				{comment.content}
			</p>

			{#if !comment.preview}
				{#if reactionTypes.length > 0}
					<div class="flex flex-wrap items-center gap-1 mt-1.5">
						{#each reactionTypes as type (type)}
							{@const mine = comment.reactions.mine.includes(type)}
							<button
								type="button"
								onclick={() => react(comment, type)}
								aria-pressed={mine}
								aria-label="{REACTION_LABEL[type]}: {comment.reactions.counts[type]}{mine
									? ', remove your reaction'
									: ''}"
								class="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] border cursor-pointer transition active:scale-95 {mine
									? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-kizuna-blue/15 dark:border-kizuna-blue/40 dark:text-kizuna-blue font-semibold'
									: 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-dark-elevated dark:border-dark-border dark:text-dark-muted'}"
							>
								<span aria-hidden="true">{REACTION_EMOJI[type]}</span>
								<span>{comment.reactions.counts[type]}</span>
							</button>
						{/each}
					</div>
				{/if}

				<div class="relative flex items-center gap-3 mt-1.5 pt-0.5">
					<button
						type="button"
						onclick={() => startReply(comment)}
						class="text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer border-0 bg-transparent p-0 flex items-center gap-1"
					>
						<Icon name="reply" class="text-[10px]" />
						<span>Reply</span>
					</button>

					<button
						type="button"
						onclick={() => (pickerFor = pickerFor === comment.id ? null : comment.id)}
						aria-expanded={pickerFor === comment.id}
						aria-label="Add reaction"
						class="text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer border-0 bg-transparent p-0 flex items-center gap-1"
					>
						<Icon name="smile" class="text-[11px]" />
						<span>React</span>
					</button>

					{#if comment.canDelete}
						<button
							type="button"
							onclick={() => remove(comment)}
							disabled={deleting === comment.id}
							class="text-[11px] font-semibold transition cursor-pointer border-0 bg-transparent p-0 flex items-center gap-1 disabled:opacity-50 {confirmingDelete ===
							comment.id
								? 'text-rose-600'
								: 'text-slate-400 hover:text-rose-600'}"
						>
							<Icon name="trash" class="text-[10px]" />
							<span>
								{deleting === comment.id
									? 'Deleting…'
									: confirmingDelete === comment.id
										? 'Tap again to delete'
										: 'Delete'}
							</span>
						</button>
					{/if}

					{#if pickerFor === comment.id}
						<div
							role="group"
							aria-label="Pick a reaction"
							class="absolute left-0 bottom-full mb-1 z-20 flex items-center gap-0.5 p-1 rounded-full bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border shadow-lg"
						>
							{#each COMMENT_REACTIONS as type (type)}
								<button
									type="button"
									onclick={() => react(comment, type)}
									aria-label={REACTION_LABEL[type]}
									aria-pressed={comment.reactions.mine.includes(type)}
									class="size-8 rounded-full text-base flex items-center justify-center border-0 cursor-pointer transition hover:scale-125 active:scale-95 {comment.reactions.mine.includes(
										type
									)
										? 'bg-blue-50 dark:bg-kizuna-blue/15'
										: 'bg-transparent hover:bg-slate-100 dark:hover:bg-dark-elevated'}"
								>
									{REACTION_EMOJI[type]}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/snippet}

{#if open}
	<div
		class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
		aria-labelledby="comments-title"
	>
		<div class="fixed inset-0" onclick={close} aria-hidden="true"></div>

		<div
			class="relative w-full max-w-lg bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border rounded-3xl shadow-2xl flex flex-col max-h-[85vh] z-10 animate-in zoom-in-95 duration-150 overflow-hidden"
		>
			<div
				class="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-dark-border"
			>
				<div class="flex items-center gap-2.5">
					<Icon name="comment" class="text-lg text-slate-700 dark:text-dark-text" />
					<h3
						id="comments-title"
						class="text-base font-bold text-slate-950 dark:text-white m-0 tracking-tight"
					>
						Comments ({total})
					</h3>
				</div>
				<button
					type="button"
					onclick={close}
					class="size-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-dark-text hover:bg-slate-100 dark:hover:bg-dark-elevated transition cursor-pointer border-0 bg-transparent"
					aria-label="Close comments"
				>
					<Icon name="cross" class="text-sm" />
				</button>
			</div>

			<div class="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
				{#if !top.loaded && top.loading}
					<div class="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
						<span
							class="size-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin"
						></span>
						<span class="text-xs">Loading comments…</span>
					</div>
				{:else if !top.loaded && loadError}
					<div class="py-12 flex flex-col items-center justify-center gap-3 text-center">
						<p class="text-sm text-slate-500 dark:text-dark-muted m-0">{loadError}</p>
						<button
							type="button"
							onclick={() => loadTop(true)}
							class="h-9 px-4 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold border-0 cursor-pointer"
						>
							Try again
						</button>
					</div>
				{:else if visible(top).length === 0}
					<div
						class="py-12 flex flex-col items-center justify-center text-slate-400 dark:text-dark-muted gap-2 text-center"
					>
						<Icon name="comment" class="text-3xl opacity-40" />
						<p class="text-sm font-medium m-0">No comments yet</p>
						<p class="text-xs text-slate-400 m-0">Be the first to share your thoughts.</p>
					</div>
				{:else}
					{#each visible(top) as comment (comment.id)}
						{@const thread = replies[comment.id]}
						<div class="flex flex-col gap-2">
							{@render commentRow(comment)}

							{#if thread?.open}
								{@const more = moreReplies(comment, thread)}
								{#if visible(thread).length > 0}
									<div
										class="ml-11 pl-3 border-l border-slate-100 dark:border-dark-border/60 flex flex-col gap-3"
									>
										{#each visible(thread) as reply (reply.id)}
											{@render commentRow(reply)}
										{/each}
									</div>
								{/if}
								<div class="ml-11 flex items-center gap-3">
									{#if thread.loading}
										<span class="text-[11px] text-slate-400">Loading replies…</span>
									{:else if more > 0}
										<button
											type="button"
											onclick={() => loadReplies(comment.id)}
											class="text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer border-0 bg-transparent p-0"
										>
											View {more} more {more === 1 ? 'reply' : 'replies'}
										</button>
									{/if}
									{#if visible(thread).length > 0}
										<button
											type="button"
											onclick={() => (thread.open = false)}
											class="text-[11px] font-semibold text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer border-0 bg-transparent p-0"
										>
											Hide replies
										</button>
									{/if}
								</div>
							{:else if comment.repliesCount > 0}
								<button
									type="button"
									onclick={() => showReplies(comment.id)}
									class="ml-11 self-start text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer border-0 bg-transparent p-0"
								>
									View {comment.repliesCount}
									{comment.repliesCount === 1 ? 'reply' : 'replies'}
								</button>
							{/if}
						</div>
					{/each}

					{#if top.nextCursor}
						<button
							type="button"
							onclick={() => loadTop()}
							disabled={top.loading}
							class="self-center h-8 px-4 rounded-full border border-slate-200 dark:border-dark-border bg-transparent text-xs font-semibold text-slate-600 dark:text-dark-muted cursor-pointer disabled:opacity-50"
						>
							{top.loading ? 'Loading…' : 'Load more comments'}
						</button>
					{/if}
					{#if loadError && top.loaded}
						<p class="text-xs text-center text-rose-600 m-0">{loadError}</p>
					{/if}
				{/if}
			</div>

			{#if replyingTo}
				<div
					class="px-4 py-2 bg-slate-100/90 dark:bg-dark-elevated text-xs text-slate-600 dark:text-dark-muted flex items-center justify-between border-t border-slate-200 dark:border-dark-border"
				>
					<span class="flex items-center gap-1.5 truncate">
						<Icon name="reply" class="text-xs text-blue-600 dark:text-kizuna-blue shrink-0" />
						<span class="truncate">
							Replying to <strong class="text-slate-900 dark:text-white"
								>{replyingTo.author.name}</strong
							>
							<span class="text-slate-500 dark:text-dark-subtle">{replyingTo.author.handle}</span>
						</span>
					</span>
					<button
						type="button"
						onclick={cancelReply}
						class="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer border-0 bg-transparent text-xs p-1 shrink-0"
						aria-label="Cancel reply"
					>
						✕
					</button>
				</div>
			{/if}

			<form
				onsubmit={handleSubmit}
				class="p-3 sm:p-4 bg-slate-50 dark:bg-dark-elevated border-t border-slate-100 dark:border-dark-border flex items-center gap-3"
			>
				<Avatar src={currentUser.image} name={currentUser.name || 'You'} size="sm" />
				<div class="flex-1 relative">
					<input
						bind:this={inputElement}
						type="text"
						bind:value={commentText}
						maxlength={1000}
						placeholder={replyingTo
							? `Reply to ${replyingTo.author.handle}...`
							: 'Add a comment...'}
						aria-label="Add a comment"
						disabled={submitting}
						class="w-full h-10 px-4 text-xs bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-full text-slate-900 dark:text-dark-text placeholder:text-slate-400 focus:outline-none focus:ring-1.5 focus:ring-slate-900 dark:focus:ring-white transition"
					/>
				</div>
				<button
					type="submit"
					disabled={!commentText.trim() || submitting}
					class="h-10 px-4 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-semibold text-xs border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition"
				>
					{submitting ? 'Posting…' : 'Post'}
				</button>
			</form>
		</div>
	</div>
{/if}
