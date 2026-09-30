<script lang="ts">
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { authClient } from '$lib/auth-client';
	import { followStore } from '$lib/utils/follow.svelte';
	import { toast } from '$lib/utils/toast.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { SuggestedCreator } from '$lib/explore/types';

	interface Props {
		class?: string;
		/** Real creators the viewer does not follow yet; the card is hidden when there are none. */
		suggestions?: SuggestedCreator[];
	}

	let { class: className = '', suggestions = [] }: Props = $props();

	const session = authClient.useSession();
	let curators = $derived(suggestions.slice(0, 3));

	const topics = [
		'#BrutalistInteriors',
		'#KyotoCeramics',
		'#Hasselblad500',
		'#BerlinTypography',
		'#FormFollowsLight',
		'#PaperCraft'
	];

	async function toggleFollow(curator: SuggestedCreator) {
		if (!$session.data?.user) {
			toast.show('Please log in to follow curators');
			const redirectTo = encodeURIComponent(window.location.pathname + window.location.search);
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() is the base; only a query is added
			await goto(`${resolve('/login')}?redirectTo=${redirectTo}`).catch(() => {});
			return;
		}
		const next = !followStore.isFollowing(curator.id);
		try {
			await followStore.set(curator.id, next);
		} catch (err) {
			toast.show(err instanceof Error ? err.message : 'Could not update follow');
		}
	}
</script>

<aside
	class="w-60 lg:w-60 xl:w-72 2xl:w-80 shrink-0 hidden lg:flex flex-col gap-3.5 xl:gap-5 py-4 xl:py-6 select-none transition-all duration-200 {className}"
	aria-label="Secondary Sidebar"
>
	{#if curators.length > 0}
		<!-- Curators to Follow Card -->
		<div
			class="curators-card w-full bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border rounded-2xl p-3.5 xl:p-5 shadow-xs dark:shadow-none"
		>
			<div class="flex items-center justify-between mb-3 xl:mb-4">
				<h3 class="font-bold text-xs xl:text-sm text-slate-900 dark:text-dark-text m-0">
					Curators to Follow
				</h3>
				<a
					href={resolve('/explore')}
					class="text-[11px] xl:text-xs font-semibold text-blue-600 dark:text-kizuna-blue hover:underline no-underline"
				>
					Explore all
				</a>
			</div>

			<div class="flex flex-col gap-3 xl:gap-3.5">
				{#each curators as curator (curator.id)}
					{@const following = followStore.isFollowing(curator.id)}
					<div class="flex items-center justify-between gap-2 xl:gap-3">
						<a
							href={resolve('/profile/[id]', { id: curator.slug })}
							class="flex items-center gap-2 xl:gap-2.5 min-w-0 no-underline"
						>
							<Avatar src={curator.image ?? ''} name={curator.name} size="sm" />
							<div class="flex flex-col min-w-0">
								<span
									class="text-xs font-semibold text-slate-900 dark:text-dark-text truncate max-w-[110px] xl:max-w-none"
								>
									{curator.name}
								</span>
								<span
									class="text-[10px] xl:text-[11px] text-slate-400 dark:text-dark-muted truncate max-w-[110px] xl:max-w-none"
								>
									{curator.handle}
								</span>
							</div>
						</a>

						<button
							type="button"
							class="text-[11px] xl:text-xs font-semibold px-2.5 xl:px-4 py-1 xl:py-1.5 rounded-full border transition-all duration-150 cursor-pointer shrink-0 disabled:opacity-50 {following
								? 'bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-muted border-slate-200 dark:border-dark-border'
								: 'bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text border-slate-200 dark:border-dark-border hover:bg-slate-50 dark:hover:bg-dark-hover shadow-2xs'}"
							disabled={followStore.isPending(curator.id)}
							aria-pressed={following}
							aria-label="{following ? 'Unfollow' : 'Follow'} {curator.name}"
							onclick={() => toggleFollow(curator)}
						>
							{following ? 'Following' : 'Follow'}
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Curated Topics Card -->
	<div
		class="topics-card w-full bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border rounded-2xl p-3.5 xl:p-5 shadow-xs dark:shadow-none"
	>
		<div class="flex items-center justify-between mb-3 xl:mb-3.5">
			<h3 class="font-bold text-xs xl:text-sm text-slate-900 dark:text-dark-text m-0">
				Curated Topics
			</h3>
			<Icon name="arrow-trend-up" class="text-slate-400 text-xs xl:text-sm" />
		</div>

		<div class="flex flex-wrap gap-1.5 xl:gap-2">
			{#each topics as topic (topic)}
				<a
					href={`#topic-${topic.replace('#', '')}`}
					class="text-[11px] xl:text-xs font-medium px-2.5 xl:px-3 py-1 xl:py-1.5 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-muted hover:bg-slate-200/80 dark:hover:bg-dark-hover hover:text-slate-900 dark:hover:text-dark-text transition-colors no-underline"
				>
					{topic}
				</a>
			{/each}
		</div>
	</div>

	<!-- Footer Links & Archive Notice -->
	<footer
		class="px-2 text-[11px] xl:text-xs text-slate-400 dark:text-dark-subtle flex flex-col gap-1.5 xl:gap-2"
	>
		<div class="flex flex-wrap gap-x-3 gap-y-1">
			<a
				href="#about"
				class="text-slate-500 dark:text-dark-muted hover:underline hover:text-slate-700 dark:hover:text-dark-text no-underline"
				>About Kizuna</a
			>
			<a
				href="#exhibitions"
				class="text-slate-500 dark:text-dark-muted hover:underline hover:text-slate-700 dark:hover:text-dark-text no-underline"
				>Exhibitions</a
			>
			<a
				href="#privacy"
				class="text-slate-500 dark:text-dark-muted hover:underline hover:text-slate-700 dark:hover:text-dark-text no-underline"
				>Privacy</a
			>
			<a
				href="#terms"
				class="text-slate-500 dark:text-dark-muted hover:underline hover:text-slate-700 dark:hover:text-dark-text no-underline"
				>Terms</a
			>
		</div>
		<p class="text-[11px] leading-relaxed text-slate-400 dark:text-dark-subtle m-0">
			Kizuna Archive © 2025. Refreshed hourly with Nordic & Japanese design dispatches.
		</p>
	</footer>
</aside>
