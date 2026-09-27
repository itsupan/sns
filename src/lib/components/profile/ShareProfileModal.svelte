<script lang="ts">
	import Icon from '$lib/components/shared/Icon.svelte';
	import { toast } from '$lib/utils/toast.svelte';
	import type { ProfileData } from '$lib/utils/profile.svelte';

	interface Props {
		open?: boolean;
		profile: ProfileData;
		onClose?: () => void;
	}

	let { open = $bindable(false), profile, onClose }: Props = $props();

	let copied = $state(false);
	let copyTimeout: ReturnType<typeof setTimeout> | null = null;

	const cleanHandle = $derived(
		profile.handle?.startsWith('@') ? profile.handle.slice(1) : profile.handle
	);

	const sharePath = $derived(
		cleanHandle || profile.id ? `/profile/${cleanHandle || profile.id}` : '/profile'
	);

	const shareUrl = $derived.by(() => {
		if (typeof window !== 'undefined') {
			return `${window.location.origin}${sharePath}`;
		}
		return sharePath;
	});

	const shareText = $derived(`Check out ${profile.name} (@${cleanHandle || 'curator'}) on Kizuna`);

	const platforms = $derived([
		{
			id: 'telegram',
			name: 'Telegram',
			color: 'bg-[#229ED9] text-white',
			url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
			icon: 'telegram'
		},
		{
			id: 'facebook',
			name: 'Facebook',
			color: 'bg-[#1877F2] text-white',
			url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
			icon: 'facebook'
		},
		{
			id: 'whatsapp',
			name: 'WhatsApp',
			color: 'bg-[#25D366] text-white',
			url: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText}: ${shareUrl}`)}`,
			icon: 'whatsapp'
		},
		{
			id: 'x',
			name: 'X',
			color: 'bg-black text-white dark:bg-white dark:text-black',
			url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
			icon: 'x'
		}
	]);

	const canNativeShare = $derived(
		typeof navigator !== 'undefined' && typeof navigator.share === 'function'
	);

	async function copyLink() {
		try {
			if (typeof navigator !== 'undefined' && navigator.clipboard) {
				await navigator.clipboard.writeText(shareUrl);
			}
			copied = true;
			toast.show('Profile link copied to clipboard');
			if (copyTimeout) clearTimeout(copyTimeout);
			copyTimeout = setTimeout(() => {
				copied = false;
			}, 2500);
		} catch {
			toast.show('Could not copy link to clipboard');
		}
	}

	async function triggerNativeShare() {
		if (navigator.share) {
			try {
				await navigator.share({
					title: `${profile.name} on Kizuna`,
					text: profile.bio || shareText,
					url: shareUrl
				});
				close();
			} catch {
				// User dismissed native share
			}
		}
	}

	function close() {
		open = false;
		onClose?.();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			close();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
		role="dialog"
		aria-modal="true"
		aria-labelledby="share-profile-title"
	>
		<!-- Backdrop click to dismiss -->
		<button
			type="button"
			class="absolute inset-0 bg-transparent border-0 cursor-default"
			aria-label="Close share dialog"
			onclick={close}
		></button>

		<!-- Modal Container -->
		<div
			class="relative w-full sm:max-w-md bg-white dark:bg-dark-card border-t sm:border border-slate-200 dark:border-dark-border rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl z-10 flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
		>
			<!-- Header -->
			<div class="flex items-center justify-between">
				<h2
					id="share-profile-title"
					class="text-base sm:text-lg font-bold text-slate-900 dark:text-white m-0"
				>
					Share Profile
				</h2>
				<button
					type="button"
					class="size-8 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-500 hover:text-slate-800 dark:text-dark-muted dark:hover:text-dark-text flex items-center justify-center cursor-pointer border-0 transition-colors"
					onclick={close}
					aria-label="Close"
				>
					<Icon name="cross" class="text-xs" />
				</button>
			</div>

			<!-- Profile Preview Card -->
			<div
				class="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 dark:bg-dark-elevated/60 border border-slate-100 dark:border-dark-border"
			>
				<div
					class="size-12 rounded-full overflow-hidden bg-slate-200 dark:bg-dark-elevated flex items-center justify-center shrink-0"
				>
					{#if profile.avatar}
						<img src={profile.avatar} alt={profile.name} class="w-full h-full object-cover" />
					{:else}
						<span class="font-bold text-base text-slate-700 dark:text-dark-text">
							{profile.name ? profile.name.slice(0, 1).toUpperCase() : 'U'}
						</span>
					{/if}
				</div>
				<div class="flex flex-col min-w-0 flex-1">
					<span class="font-bold text-sm text-slate-900 dark:text-white truncate">
						{profile.name}
					</span>
					<span class="text-xs text-slate-500 dark:text-dark-muted truncate">
						@{cleanHandle}
					</span>
					{#if profile.bio}
						<p class="text-[11px] text-slate-600 dark:text-dark-muted line-clamp-1 mt-0.5 m-0">
							{profile.bio}
						</p>
					{/if}
				</div>
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
					Profile Link
				</span>
				<div
					class="flex items-center gap-2 p-1.5 pl-3 rounded-2xl bg-slate-100 dark:bg-dark-elevated border border-slate-200 dark:border-dark-border"
				>
					<Icon name="link" class="text-xs text-slate-400 shrink-0" />
					<input
						type="text"
						readonly
						value={shareUrl}
						class="w-full bg-transparent border-0 text-xs font-medium text-slate-800 dark:text-dark-text focus:outline-none select-all truncate"
					/>
					<button
						type="button"
						class="h-9 px-4 rounded-xl font-semibold text-xs transition-all cursor-pointer border-0 shrink-0 flex items-center justify-center gap-1.5 {copied
							? 'bg-green-600 text-white'
							: 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 hover:opacity-90'}"
						onclick={copyLink}
					>
						{#if copied}
							<Icon name="check" class="text-xs" />
							<span>Copied!</span>
						{:else}
							<Icon name="copy" class="text-xs" />
							<span>Copy</span>
						{/if}
					</button>
				</div>
			</div>

			<!-- Native share sheet fallback if supported -->
			{#if canNativeShare}
				<button
					type="button"
					class="w-full h-11 rounded-full bg-slate-100 dark:bg-dark-elevated hover:bg-slate-200 dark:hover:bg-dark-hover text-slate-800 dark:text-dark-text font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border border-slate-200 dark:border-dark-border"
					onclick={triggerNativeShare}
				>
					<Icon name="share" class="text-xs" />
					<span>More options...</span>
				</button>
			{/if}
		</div>
	</div>
{/if}
