<script lang="ts">
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';

	interface Curator {
		id: string;
		name: string;
		handle: string;
		avatar: string;
		following?: boolean;
	}

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	let curators = $state<Curator[]>([
		{
			id: 'c1',
			name: 'Sophia Vane',
			handle: '@vane.studio',
			avatar:
				'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
			following: false
		},
		{
			id: 'c2',
			name: 'Lars Lindqvist',
			handle: '@lindqvist.nord',
			avatar:
				'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
			following: false
		},
		{
			id: 'c3',
			name: 'Garamond Press',
			handle: '@garamond.edit',
			avatar:
				'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
			following: false
		}
	]);

	const topics = [
		'#BrutalistInteriors',
		'#KyotoCeramics',
		'#Hasselblad500',
		'#BerlinTypography',
		'#FormFollowsLight',
		'#PaperCraft'
	];

	function toggleFollow(curatorId: string) {
		const curator = curators.find((c) => c.id === curatorId);
		if (curator) {
			curator.following = !curator.following;
		}
	}
</script>

<aside
	class="w-72 lg:w-80 shrink-0 hidden lg:flex flex-col gap-5 py-6 select-none {className}"
	aria-label="Secondary Sidebar"
>
	<!-- Curators to Follow Card -->
	<div
		class="curators-card w-full bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border rounded-2xl p-5 shadow-xs dark:shadow-none"
	>
		<div class="flex items-center justify-between mb-4">
			<h3 class="font-bold text-sm text-slate-900 dark:text-dark-text m-0">Curators to Follow</h3>
			<a
				href="#explore"
				class="text-xs font-semibold text-blue-600 dark:text-kizuna-blue hover:underline no-underline"
			>
				Explore all
			</a>
		</div>

		<div class="flex flex-col gap-3.5">
			{#each curators as curator (curator.id)}
				<div class="flex items-center justify-between gap-3">
					<div class="flex items-center gap-2.5 min-w-0">
						<Avatar src={curator.avatar} name={curator.name} size="md" />
						<div class="flex flex-col min-w-0">
							<span class="text-xs font-semibold text-slate-900 dark:text-dark-text truncate">
								{curator.name}
							</span>
							<span class="text-[11px] text-slate-400 dark:text-dark-muted truncate">
								{curator.handle}
							</span>
						</div>
					</div>

					<button
						type="button"
						class="text-xs font-semibold px-4 py-1.5 rounded-full border transition-all duration-150 cursor-pointer {curator.following
							? 'bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-muted border-slate-200 dark:border-dark-border'
							: 'bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text border-slate-200 dark:border-dark-border hover:bg-slate-50 dark:hover:bg-dark-hover shadow-2xs'}"
						onclick={() => toggleFollow(curator.id)}
					>
						{curator.following ? 'Following' : 'Follow'}
					</button>
				</div>
			{/each}
		</div>
	</div>

	<!-- Curated Topics Card -->
	<div
		class="topics-card w-full bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border rounded-2xl p-5 shadow-xs dark:shadow-none"
	>
		<div class="flex items-center justify-between mb-3.5">
			<h3 class="font-bold text-sm text-slate-900 dark:text-dark-text m-0">Curated Topics</h3>
			<Icon name="arrow-trend-up" class="text-slate-400 text-sm" />
		</div>

		<div class="flex flex-wrap gap-2">
			{#each topics as topic (topic)}
				<a
					href={`#topic-${topic.replace('#', '')}`}
					class="text-xs font-medium px-3 py-1.5 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-muted hover:bg-slate-200/80 dark:hover:bg-dark-hover hover:text-slate-900 dark:hover:text-dark-text transition-colors no-underline"
				>
					{topic}
				</a>
			{/each}
		</div>
	</div>

	<!-- Footer Links & Archive Notice -->
	<footer class="px-2 text-xs text-slate-400 dark:text-dark-subtle flex flex-col gap-2">
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
