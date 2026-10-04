<script lang="ts">
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import ShareLinks from '$lib/components/shared/ShareLinks.svelte';
	import { toast } from '$lib/utils/toast.svelte';
	import { displayHandle } from '$lib/utils/format';
	import type { ProfileData } from '$lib/utils/profile.svelte';
	import { m } from '$lib/i18n';

	interface Props {
		open?: boolean;
		profile: ProfileData;
	}

	let { open = $bindable(false), profile }: Props = $props();

	let copied = $state(false);
	let copyTimeout: ReturnType<typeof setTimeout> | null = null;

	// `/profile/[id]` resolves a handle or a user id, nothing else.
	const sharePath = $derived(`/profile/${profile.handle || profile.id}`);

	const shareUrl = $derived.by(() => {
		if (typeof window !== 'undefined') {
			return `${window.location.origin}${sharePath}`;
		}
		return sharePath;
	});

	const shareText = $derived(
		profile.handle
			? m.share_profile_text_with_handle(profile.name, profile.handle)
			: m.share_profile_text(profile.name)
	);

	const canNativeShare = $derived(
		typeof navigator !== 'undefined' && typeof navigator.share === 'function'
	);

	async function copyLink() {
		try {
			if (typeof navigator !== 'undefined' && navigator.clipboard) {
				await navigator.clipboard.writeText(shareUrl);
			}
			copied = true;
			toast.show(m.share_profile_copied());
			if (copyTimeout) clearTimeout(copyTimeout);
			copyTimeout = setTimeout(() => {
				copied = false;
			}, 2500);
		} catch {
			toast.show(m.share_copy_failed());
		}
	}

	async function triggerNativeShare() {
		if (navigator.share) {
			try {
				await navigator.share({
					title: m.share_profile_title(profile.name),
					text: profile.bio || shareText,
					url: shareUrl
				});
				open = false;
			} catch {
				// User dismissed native share
			}
		}
	}
</script>

<Modal bind:open label={m.share_profile()} variant="sheet">
	<div
		class="w-full md:max-w-md max-h-[90dvh] overflow-y-auto bg-white dark:bg-dark-card border-t md:border border-slate-200 dark:border-dark-border rounded-t-3xl md:rounded-3xl p-5 md:p-6 shadow-2xl flex flex-col gap-5"
	>
		<!-- Header -->
		<div class="flex items-center justify-between">
			<h2 class="text-base md:text-lg font-bold text-slate-900 dark:text-white m-0">
				{m.share_profile()}
			</h2>
			<button
				type="button"
				class="size-8 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-500 hover:text-slate-800 dark:text-dark-muted dark:hover:text-dark-text flex items-center justify-center cursor-pointer border-0 transition-colors"
				onclick={() => (open = false)}
				aria-label={m.common_close()}
			>
				<Icon name="cross" class="text-xs" />
			</button>
		</div>

		<!-- Profile Preview Card -->
		<div
			class="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 dark:bg-dark-elevated/60 border border-slate-100 dark:border-dark-border"
		>
			<Avatar src={profile.avatar} name={profile.name} size="lg" />
			<div class="flex flex-col min-w-0 flex-1">
				<span class="font-bold text-sm text-slate-900 dark:text-white truncate">
					{profile.name}
				</span>
				<span class="text-xs text-slate-500 dark:text-dark-muted truncate">
					{displayHandle(profile.handle, profile.name)}
				</span>
				{#if profile.bio}
					<p class="text-[11px] text-slate-600 dark:text-dark-muted line-clamp-1 mt-0.5 m-0">
						{profile.bio}
					</p>
				{/if}
			</div>
		</div>

		<ShareLinks url={shareUrl} text={shareText} />

		<!-- Copy Link Row -->
		<div class="flex flex-col gap-2">
			<span
				class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-dark-muted"
			>
				{m.share_profile_link()}
			</span>
			<div
				class="flex items-center gap-2 p-1.5 pl-3 rounded-2xl bg-slate-100 dark:bg-dark-elevated border border-slate-200 dark:border-dark-border"
			>
				<Icon name="link" class="text-xs text-slate-400 shrink-0" />
				<input
					type="text"
					readonly
					value={shareUrl}
					aria-label={m.share_profile_url()}
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
						<span>{m.share_copied()}</span>
					{:else}
						<Icon name="copy" class="text-xs" />
						<span>{m.common_copy()}</span>
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
				<span>{m.share_more_options()}</span>
			</button>
		{/if}
	</div>
</Modal>
