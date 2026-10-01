<script lang="ts">
	import { stripFormatting } from '$lib/formatting';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { toast } from '$lib/utils/toast.svelte';
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

	let shareTitle = $derived(post.title || `Post by ${post.author.name}`);
	let plainDescription = $derived(post.description ? stripFormatting(post.description) : '');
	let shareText = $derived(
		plainDescription
			? `${shareTitle} — "${plainDescription.slice(0, 100)}${plainDescription.length > 100 ? '…' : ''}" on Kizuna`
			: `${shareTitle} on Kizuna`
	);

	let encodedUrl = $derived(encodeURIComponent(postUrl));
	let encodedText = $derived(encodeURIComponent(shareText));

	interface SharePlatform {
		id: string;
		name: string;
		icon: 'telegram' | 'facebook' | 'whatsapp' | 'x';
		color: string;
		url: string;
	}

	let platforms = $derived<SharePlatform[]>([
		{
			id: 'telegram',
			name: 'Telegram',
			icon: 'telegram',
			color: 'bg-[#229ED9] text-white',
			url: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`
		},
		{
			id: 'facebook',
			name: 'Facebook',
			icon: 'facebook',
			color: 'bg-[#1877F2] text-white',
			url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
		},
		{
			id: 'whatsapp',
			name: 'WhatsApp',
			icon: 'whatsapp',
			color: 'bg-[#25D366] text-white',
			url: `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`
		},
		{
			id: 'x',
			name: 'X (Twitter)',
			icon: 'x',
			color: 'bg-black text-white dark:bg-white dark:text-black',
			url: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`
		}
	]);

	let canNativeShare = $derived(typeof navigator !== 'undefined' && Boolean(navigator.share));

	function close() {
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			close();
		}
	}

	async function copyLink() {
		if (typeof window === 'undefined') return;

		try {
			await navigator.clipboard.writeText(postUrl);
			copied = true;
			toast.show('Post link copied to clipboard!');
			onShare?.();

			if (copyTimeout) clearTimeout(copyTimeout);
			copyTimeout = setTimeout(() => {
				copied = false;
			}, 2500);
		} catch {
			toast.show('Failed to copy link');
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

	function handlePlatformClick() {
		onShare?.();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Modal Backdrop -->
	<div
		class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
		aria-labelledby="share-post-title"
	>
		<div class="fixed inset-0" onclick={close} aria-hidden="true"></div>

		<!-- Dialog Body -->
		<div
			class="relative w-full max-w-md bg-white dark:bg-dark-card border border-slate-200/80 dark:border-dark-border rounded-3xl p-6 shadow-2xl flex flex-col gap-5 z-10 animate-in zoom-in-95 duration-150"
		>
			<!-- Header -->
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2.5">
					<div
						class="size-9 rounded-xl bg-slate-100 dark:bg-dark-elevated flex items-center justify-center text-slate-800 dark:text-dark-text"
					>
						<Icon name="paper-plane" class="text-lg" />
					</div>
					<h3
						id="share-post-title"
						class="text-lg font-bold text-slate-950 dark:text-white m-0 tracking-tight"
					>
						Share Post
					</h3>
				</div>
				<button
					type="button"
					onclick={close}
					class="size-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-dark-text hover:bg-slate-100 dark:hover:bg-dark-elevated transition cursor-pointer border-0 bg-transparent"
					aria-label="Close share dialog"
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

			<!-- Share Platforms Grid -->
			<div class="flex flex-col gap-2">
				<span
					class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-dark-muted"
				>
					Share via
				</span>
				<div class="grid grid-cols-4 gap-2.5 pt-1">
					<!-- eslint-disable svelte/no-navigation-without-resolve -- external share URLs -->
					{#each platforms as platform (platform.id)}
						<a
							href={platform.url}
							target="_blank"
							rel="noopener noreferrer"
							onclick={handlePlatformClick}
							class="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-dark-elevated text-slate-700 dark:text-dark-text transition-all no-underline group active:scale-95"
						>
							<div
								class="size-12 rounded-2xl {platform.color} flex items-center justify-center shadow-xs transition-transform group-hover:scale-105"
							>
								{#if platform.icon === 'telegram'}
									<svg class="size-6 fill-current" viewBox="0 0 24 24">
										<path
											d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"
										/>
									</svg>
								{:else if platform.icon === 'facebook'}
									<svg class="size-6 fill-current" viewBox="0 0 24 24">
										<path
											d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
										/>
									</svg>
								{:else if platform.icon === 'whatsapp'}
									<svg class="size-6 fill-current" viewBox="0 0 24 24">
										<path
											d="M17.472 14.382c-.301-.15-1.782-.879-2.058-.979-.276-.1-.476-.15-.677.15-.2.301-.776.979-.952 1.18-.175.201-.351.226-.652.075-.301-.15-1.272-.469-2.424-1.496-.895-.798-1.5-1.784-1.675-2.085-.176-.301-.019-.464.132-.614.135-.135.301-.351.451-.527.151-.176.201-.301.301-.502.101-.2.05-.376-.025-.527-.075-.15-.677-1.632-.928-2.234-.244-.588-.493-.508-.677-.517l-.578-.01c-.2 0-.527.075-.803.376s-1.054 1.029-1.054 2.509c0 1.48 1.079 2.909 1.229 3.11.15.201 2.124 3.243 5.146 4.549.719.311 1.28.497 1.718.636.722.23 1.378.197 1.898.12.579-.087 1.782-.728 2.033-1.431.251-.703.251-1.306.176-1.431-.076-.126-.276-.201-.577-.352zM12.04 2C6.51 2 2.02 6.49 2.02 12.02c0 1.954.56 3.864 1.62 5.517L2 22l4.636-1.587a10.02 10.02 0 005.404 1.587c5.53 0 10.02-4.49 10.02-10.02C22.06 6.49 17.57 2 12.04 2z"
										/>
									</svg>
								{:else if platform.icon === 'x'}
									<svg class="size-5 fill-current" viewBox="0 0 24 24">
										<path
											d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
										/>
									</svg>
								{/if}
							</div>
							<span class="text-[11px] font-medium text-slate-700 dark:text-dark-text">
								{platform.name}
							</span>
						</a>
					{/each}
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</div>
			</div>

			<!-- Copy Link Row -->
			<div class="flex flex-col gap-2">
				<span
					class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-dark-muted"
				>
					Or copy link
				</span>
				<div
					class="flex items-center gap-2 p-1.5 pl-3 rounded-2xl bg-slate-100 dark:bg-dark-elevated border border-slate-200/60 dark:border-dark-border"
				>
					<Icon name="link" class="text-slate-400 text-sm shrink-0" />
					<input
						type="text"
						readonly
						value={postUrl}
						aria-label="Post URL"
						class="flex-1 bg-transparent border-0 text-xs text-slate-700 dark:text-dark-text font-mono truncate focus:outline-none select-all"
					/>
					<button
						type="button"
						onclick={copyLink}
						class="px-4 py-2 rounded-xl text-xs font-semibold transition active:scale-95 border-0 cursor-pointer shadow-xs {copied
							? 'bg-emerald-600 text-white'
							: 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200'}"
					>
						{copied ? 'Copied!' : 'Copy'}
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
					<span>More share options</span>
				</button>
			{/if}
		</div>
	</div>
{/if}
