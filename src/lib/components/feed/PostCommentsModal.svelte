<script lang="ts">
	import { readApiError } from '$lib/utils/api-error';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { authClient } from '$lib/auth-client';
	import { toast } from '$lib/utils/toast.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PostData, PostComment } from './PostCard.svelte';

	interface CommentItem {
		id: string;
		content: string;
		createdAt: string | Date;
		timeAgo: string;
		likes?: number;
		liked?: boolean;
		replyTo?: {
			name: string;
			handle: string;
		};
		author: {
			id: string;
			name: string;
			handle: string;
			avatar: string;
		};
	}

	interface Props {
		open?: boolean;
		post: PostData;
		onCommentAdded?: (comment: PostComment, newCount: number) => void;
	}

	let { open = $bindable(false), post, onCommentAdded }: Props = $props();

	const session = authClient.useSession();

	let comments = $state<CommentItem[]>([]);
	let loading = $state(false);
	let submitting = $state(false);
	let commentText = $state('');
	let replyingTo = $state<CommentItem | null>(null);
	let commentLikes = $state<Record<string, { count: number; liked: boolean }>>({});
	let inputElement = $state<HTMLInputElement | null>(null);

	let currentUser = $derived({
		id: ($session.data?.user as { id?: string } | undefined)?.id || '',
		name: $session.data?.user?.name || '',
		image: $session.data?.user?.image || ''
	});

	function close() {
		open = false;
		replyingTo = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			close();
		}
	}

	function isPostAuthor(comment: CommentItem): boolean {
		if (comment.author.id && post.author.id && comment.author.id === post.author.id) {
			return true;
		}
		if (comment.author.handle && post.author.handle) {
			const cleanComment = comment.author.handle.toLowerCase().replace(/^@/, '').trim();
			const cleanPost = post.author.handle.toLowerCase().replace(/^@/, '').trim();
			if (cleanComment === cleanPost) return true;
		}
		if (comment.author.name && post.author.name) {
			if (comment.author.name.trim().toLowerCase() === post.author.name.trim().toLowerCase()) {
				return true;
			}
		}
		return false;
	}

	function isCurrentUser(comment: CommentItem): boolean {
		if (comment.author.id && currentUser.id && comment.author.id === currentUser.id) {
			return true;
		}
		if (comment.author.name && currentUser.name && comment.author.name === currentUser.name) {
			return true;
		}
		return false;
	}

	function getCommentLikes(comment: CommentItem) {
		return (
			commentLikes[comment.id] ?? {
				count: comment.likes ?? 0,
				liked: comment.liked ?? false
			}
		);
	}

	function toggleCommentLike(comment: CommentItem) {
		if (!$session.data?.user) {
			toast.show('Please log in to like comments');
			return;
		}
		const current = getCommentLikes(comment);
		const nextLiked = !current.liked;
		commentLikes[comment.id] = {
			count: Math.max(0, current.count + (nextLiked ? 1 : -1)),
			liked: nextLiked
		};
		navigator.vibrate?.(10);
	}

	function startReply(targetComment: CommentItem) {
		replyingTo = targetComment;
		const targetHandle = targetComment.author.handle.startsWith('@')
			? targetComment.author.handle
			: `@${targetComment.author.handle}`;
		const handlePrefix = `${targetHandle} `;
		if (!commentText.includes(handlePrefix)) {
			commentText = `${handlePrefix}${commentText}`;
		}
		setTimeout(() => inputElement?.focus(), 50);
	}

	function cancelReply() {
		if (replyingTo) {
			const targetHandle = replyingTo.author.handle.startsWith('@')
				? replyingTo.author.handle
				: `@${replyingTo.author.handle}`;
			const handlePrefix = `${targetHandle} `;
			if (commentText.startsWith(handlePrefix)) {
				commentText = commentText.replace(handlePrefix, '');
			}
			replyingTo = null;
		}
	}

	async function loadComments() {
		loading = true;
		try {
			const res = await fetch(`/api/posts/${post.id}/comments`);
			if (res.ok) {
				const data = (await res.json()) as { comments?: CommentItem[] };
				comments = data.comments || [];
			} else {
				// If post comment preview exists, show it as initial comment
				if (post.commentPreview) {
					comments = [
						{
							id: 'preview-1',
							content: post.commentPreview.content,
							createdAt: new Date(),
							timeAgo: 'Recently',
							likes: 2,
							author: {
								id: 'preview-author',
								name: post.commentPreview.author,
								handle: `@${post.commentPreview.author.replace(/^@/, '')}`,
								avatar: ''
							}
						}
					];
				}
			}
		} catch {
			if (post.commentPreview) {
				comments = [
					{
						id: 'preview-1',
						content: post.commentPreview.content,
						createdAt: new Date(),
						timeAgo: 'Recently',
						likes: 2,
						author: {
							id: 'preview-author',
							name: post.commentPreview.author,
							handle: `@${post.commentPreview.author.replace(/^@/, '')}`,
							avatar: ''
						}
					}
				];
			}
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (open) {
			loadComments();
		}
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = commentText.trim();
		if (!trimmed || submitting) return;

		if (!$session.data?.user) {
			toast.show('Please log in to add comments');
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
			return;
		}

		submitting = true;
		const replyMeta = replyingTo
			? {
					name: replyingTo.author.name,
					handle: replyingTo.author.handle
				}
			: undefined;

		try {
			const res = await fetch(`/api/posts/${post.id}/comments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: trimmed })
			});

			if (!res.ok) {
				const data = await res.json().catch(() => null);
				throw new Error(readApiError(data, 'Failed to post comment').message);
			}

			const data = (await res.json()) as { comment: CommentItem; commentsCount: number };
			const newComment: CommentItem = {
				...data.comment,
				replyTo: replyMeta,
				likes: 0,
				liked: false
			};
			comments = [...comments, newComment];
			commentText = '';
			replyingTo = null;
			toast.show('Comment posted');

			onCommentAdded?.(
				{
					author: newComment.author.handle || newComment.author.name,
					content: newComment.content
				},
				data.commentsCount
			);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Could not post comment';
			toast.show(message);
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

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
			<!-- Header -->
			<div
				class="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-dark-border"
			>
				<div class="flex items-center gap-2.5">
					<Icon name="comment" class="text-lg text-slate-700 dark:text-dark-text" />
					<h3
						id="comments-title"
						class="text-base font-bold text-slate-950 dark:text-white m-0 tracking-tight"
					>
						Comments ({post.commentsCount})
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

			<!-- Comments List -->
			<div
				class="flex-1 overflow-y-auto p-5 flex flex-col gap-4 divide-y divide-slate-100 dark:divide-dark-border/40"
			>
				{#if loading}
					<div class="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
						<span
							class="size-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin"
						></span>
						<span class="text-xs">Loading comments…</span>
					</div>
				{:else if comments.length === 0}
					<div
						class="py-12 flex flex-col items-center justify-center text-slate-400 dark:text-dark-muted gap-2 text-center"
					>
						<Icon name="comment" class="text-3xl opacity-40" />
						<p class="text-sm font-medium m-0">No comments yet</p>
						<p class="text-xs text-slate-400 m-0">Be the first to share your thoughts.</p>
					</div>
				{:else}
					{#each comments as comment (comment.id)}
						{@const likesInfo = getCommentLikes(comment)}
						<div class="flex items-start gap-3 pt-3 first:pt-0 group">
							<Avatar src={comment.author.avatar} name={comment.author.name} size="sm" />
							<div class="flex flex-col min-w-0 flex-1">
								<!-- Author Name, Badges & Time -->
								<div class="flex items-center gap-1.5 flex-wrap leading-tight">
									<span class="text-xs font-semibold text-slate-900 dark:text-dark-text truncate">
										{comment.author.name}
									</span>

									<!-- Author Identification Badge -->
									{#if isPostAuthor(comment)}
										<span
											class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-950 text-[9px] font-bold tracking-wider uppercase shadow-2xs"
											title="Post Creator"
										>
											Author
										</span>
									{/if}

									<!-- Current User Badge -->
									{#if isCurrentUser(comment) && !isPostAuthor(comment)}
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

								<!-- Replying To Indicator -->
								{#if comment.replyTo}
									<div
										class="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-kizuna-blue font-medium mt-0.5"
									>
										<Icon name="reply" class="text-[10px]" />
										<span>Replying to {comment.replyTo.handle || comment.replyTo.name}</span>
									</div>
								{/if}

								<!-- Comment Content -->
								<p
									class="text-xs leading-relaxed text-slate-700 dark:text-dark-muted mt-1 m-0 break-words"
								>
									{comment.content}
								</p>

								<!-- Actions Bar: Reply button & Like button -->
								<div class="flex items-center gap-3 mt-1.5 pt-0.5">
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
										onclick={() => toggleCommentLike(comment)}
										class="flex items-center gap-1 text-[11px] font-medium transition cursor-pointer border-0 bg-transparent p-0 active:scale-90 {likesInfo.liked
											? 'text-rose-500 font-semibold'
											: 'text-slate-400 hover:text-slate-700 dark:hover:text-dark-text'}"
										aria-label={likesInfo.liked ? 'Unlike comment' : 'Like comment'}
									>
										<Icon
											name="heart"
											type={likesInfo.liked ? 'sr' : 'rr'}
											class="text-xs {likesInfo.liked ? 'animate-heart-pop' : ''}"
										/>
										{#if likesInfo.count > 0}
											<span>{likesInfo.count}</span>
										{/if}
									</button>
								</div>
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Replying To Banner -->
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

			<!-- Comment Input Footer -->
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
