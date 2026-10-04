<script lang="ts">
	import { stripFormatting } from '$lib/formatting';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import ShareLinks from '$lib/components/shared/ShareLinks.svelte';
	import { toast } from '$lib/utils/toast.svelte';
	import { m } from '$lib/i18n';
	import type { PostData } from './PostCard.svelte';

	interface Props {
		open?: boolean;
		post: PostData;
		onShare?: () => void;
	}

	let { open = $bindable(false), post, onShare }: Props = $props();

	let copied = $state(false);
	let copyTimeout: ReturnType<typeof setTimeout> | undefined;

	let origin = $derived(typeof window !== 'undefined' ? window.location.origin : '');
	let postUrl = $derived(origin ? `${origin}/post/${post.id}` : `/post/${post.id}`);

	let shareTitle = $derived(post.title || m.post_by(post.author.name));
	let plainDescription = $derived(post.description ? stripFormatting(post.description) : '');
	let shareText = $derived(
		plainDescription
			? m.share_post_text_with_excerpt(
					shareTitle,
					`${plainDescription.slice(0, 100)}${plainDescription.length > 100 ? '…' : ''}`
				)
			: m.share_post_text(shareTitle)
	);

	let canNativeShare = $derived(typeof navigator !== 'undefined' && Boolean(navigator.share));

	function close() {
		open = false;
	}

	async function copyLink() {
		if (typeof window === 'undefined') return;

		try {
			await navigator.clipboard.writeText(postUrl);
			copied = true;
			toast.show(m.share_post_copied());
			onShare?.();

			if (copyTimeout) clearTimeout(copyTimeout);
			copyTimeout = setTimeout(() => {
				copied = false;
			}, 2500);
		} catch {
			toast.show(m.share_copy_link_failed());
		}
	}

	async function handleNativeShare() {
		if (typeof navigator === 'undefined' || !navigator.share) {
			await copyLink();
			return;
		}

		try {
			await navigator.share({
				title: shareTitle,
				text: shareText,
				url: postUrl
			});
			onShare?.();
			close();
		} catch (err) {
			if (err instanceof Error && err.name !== 'AbortError') {
				await copyLink();
			}
		}
	}
</script>

<Modal bind:open label={m.share_post()}>
	<div
		class="w-full max-w-md max-h-full overflow-y-auto bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border rounded-3xl p-6 shadow-2xl flex flex-col gap-5"
	>
		<!-- Header -->
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2.5">
				<div
					class="size-9 rounded-xl bg-slate-100 dark:bg-dark-elevated flex items-center justify-center text-slate-800 dark:text-dark-text"
				>
					<Icon name="paper-plane" class="text-lg" />
				</div>
				<h3 class="text-lg font-bold text-slate-950 dark:text-white m-0 tracking-tight">
					{m.share_post()}
				</h3>
			</div>
			<button
				type="button"
				onclick={close}
				class="size-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-dark-text hover:bg-slate-100 dark:hover:bg-dark-elevated transition cursor-pointer border-0 bg-transparent"
				aria-label={m.share_close()}
			>
				<Icon name="cross" class="text-sm" />
			</button>
		</div>

		<!-- Post Preview Card -->
		<div
			class="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-dark-elevated border border-slate-100 dark:border-dark-border"
		>
			<Avatar src={post.author.avatar} name={post.author.name} size="md" />
			<div class="flex flex-col min-w-0 flex-1">
				<span class="text-sm font-semibold text-slate-900 dark:text-dark-text truncate">
					{post.author.name}
				</span>
				<p class="text-xs text-slate-500 dark:text-dark-muted line-clamp-1 m-0 mt-0.5">
					{post.title || plainDescription}
				</p>
			</div>
			{#if post.mediaItems?.[0]?.url || post.mediaUrl || post.image}
				<div class="size-11 rounded-lg overflow-hidden shrink-0 bg-slate-200 dark:bg-dark-border">
					<img
						src={post.mediaItems?.[0]?.url || post.mediaUrl || post.image}
						alt=""
						class="w-full h-full object-cover"
						loading="lazy"
					/>
				</div>
			{/if}
		</div>

		<ShareLinks url={postUrl} text={shareText} onshare={onShare} />

		<!-- Copy Link Row -->
		<div class="flex flex-col gap-2">
			<span
				class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-dark-muted"
			>
				{m.share_or_copy_link()}
			</span>
			<div
				class="flex items-center gap-2 p-1.5 pl-3 rounded-2xl bg-slate-100 dark:bg-dark-elevated border border-slate-200/60 dark:border-dark-border"
			>
				<Icon name="link" class="text-slate-400 text-sm shrink-0" />
				<input
					type="text"
					readonly
					value={postUrl}
					aria-label={m.share_post_url()}
					class="flex-1 bg-transparent border-0 text-xs text-slate-700 dark:text-dark-text font-mono truncate focus:outline-none select-all"
				/>
				<button
					type="button"
					onclick={copyLink}
					class="px-4 py-2 rounded-xl text-xs font-semibold transition active:scale-95 border-0 cursor-pointer shadow-xs {copied
						? 'bg-emerald-600 text-white'
						: 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200'}"
				>
					{copied ? m.share_copied() : m.common_copy()}
				</button>
			</div>
		</div>

		<!-- Mobile Native Share Button -->
		{#if canNativeShare}
			<button
				type="button"
				onclick={handleNativeShare}
				class="w-full py-2.5 rounded-2xl bg-slate-100 dark:bg-dark-elevated hover:bg-slate-200 dark:hover:bg-dark-hover text-slate-800 dark:text-dark-text text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer border-0"
			>
				<Icon name="share" class="text-sm" />
				<span>{m.share_more_share_options()}</span>
			</button>
		{/if}
	</div>
</Modal>
