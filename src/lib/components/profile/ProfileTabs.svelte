<script lang="ts">
	import Icon from '$lib/components/shared/Icon.svelte';
	import type { IconName } from '$lib/components/shared/icons';
	import { m } from '$lib/i18n';

	export type TabId = 'grid' | 'saved';
	export type ViewMode = 'grid' | 'feed' | 'compact';

	interface Props {
		activeTab?: TabId;
		viewMode?: ViewMode;
		class?: string;
		/** The Saved tab is private: only shown on your own profile. */
		showSaved?: boolean;
		onTabChange?: (tab: TabId) => void;
		onViewChange?: (view: ViewMode) => void;
	}

	let {
		activeTab = $bindable('grid'),
		viewMode = $bindable('grid'),
		class: className = '',
		showSaved = true,
		onTabChange,
		onViewChange
	}: Props = $props();

	interface TabDef {
		id: TabId;
		label: string;
		icon: IconName;
	}

	const allTabs: TabDef[] = [
		{ id: 'grid', label: m.profile_tab_grid(), icon: 'apps' },
		{ id: 'saved', label: m.profile_tab_saved(), icon: 'bookmark' }
	];
	let tabs = $derived(allTabs.filter((t) => showSaved || t.id !== 'saved'));

	const viewModes: { id: ViewMode; label: string; icon: IconName }[] = [
		{ id: 'grid', label: m.profile_view_grid(), icon: 'apps' },
		{ id: 'feed', label: m.profile_view_feed(), icon: 'border-all' },
		{ id: 'compact', label: m.profile_view_compact(), icon: 'menu-burger' }
	];

	function selectTab(id: TabId) {
		activeTab = id;
		onTabChange?.(id);
	}

	function selectView(mode: ViewMode) {
		viewMode = mode;
		onViewChange?.(mode);
	}
</script>

<div
	class="w-full select-none sticky top-0 z-30 sm:static bg-white dark:bg-dark-card sm:bg-transparent sm:dark:bg-transparent border-b sm:border-b border-t sm:border-t-0 sm:border-b border-slate-200 dark:border-dark-border {className}"
>
	<div class="flex items-center justify-between sm:py-4">
		<!-- Tabs Bar (Mobile: Icon Tabs / Desktop: Filter Pills) -->
		<div
			class="w-full sm:w-auto grid {tabs.length === 1
				? 'grid-cols-1'
				: 'grid-cols-2'} sm:flex sm:items-center gap-0 sm:gap-2"
		>
			{#each tabs as tab (tab.id)}
				{@const isActive = activeTab === tab.id}
				<button
					type="button"
					class="relative cursor-pointer transition-all duration-150 border-0 flex items-center justify-center h-12 sm:h-auto sm:px-4 sm:py-2 sm:rounded-full bg-transparent text-sm sm:text-xs font-semibold {isActive
						? 'text-slate-950 dark:text-white sm:bg-slate-950 sm:text-white sm:dark:bg-white sm:dark:text-slate-950 sm:shadow-xs'
						: 'text-slate-500 dark:text-dark-muted hover:text-slate-700 dark:hover:text-dark-text sm:hover:bg-slate-100 sm:dark:hover:bg-dark-elevated'}"
					onclick={() => selectTab(tab.id)}
					role="tab"
					aria-selected={isActive}
					aria-label={tab.label}
				>
					<!-- Mobile Icon -->
					<Icon name={tab.icon} type={isActive ? 'sr' : 'rr'} class="text-xl sm:hidden" />

					<!-- Desktop Label -->
					<span class="hidden sm:inline">{tab.label}</span>

					<!-- Mobile Active Underline -->
					{#if isActive}
						<span
							class="sm:hidden absolute bottom-0 left-0 right-0 h-0.5 bg-slate-950 dark:bg-white transition-all"
						></span>
					{/if}
				</button>
			{/each}
		</div>

		<!-- Desktop: View Mode Switcher -->
		<div class="hidden sm:flex items-center gap-1 shrink-0">
			{#each viewModes as mode (mode.id)}
				{@const isActive = viewMode === mode.id}
				<button
					type="button"
					class="size-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer border-0 bg-transparent {isActive
						? 'text-slate-950 dark:text-white bg-slate-100 dark:bg-dark-elevated'
						: 'text-slate-400 dark:text-dark-muted hover:text-slate-900 dark:hover:text-white'}"
					onclick={() => selectView(mode.id)}
					aria-label={mode.label}
					title={mode.label}
				>
					<Icon name={mode.icon} class="text-sm" />
				</button>
			{/each}
		</div>
	</div>
</div>
