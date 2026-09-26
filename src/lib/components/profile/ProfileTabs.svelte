<script lang="ts">
	import Icon from '$lib/components/shared/Icon.svelte';

	export type TabId = 'grid' | 'essays' | 'pinned' | 'critiques' | 'saved';
	export type ViewMode = 'grid' | 'feed' | 'compact';

	interface Props {
		activeTab?: TabId;
		viewMode?: ViewMode;
		class?: string;
		onTabChange?: (tab: TabId) => void;
		onViewChange?: (view: ViewMode) => void;
	}

	let {
		activeTab = $bindable('grid'),
		viewMode = $bindable('grid'),
		class: className = '',
		onTabChange,
		onViewChange
	}: Props = $props();

	interface TabDef {
		id: TabId;
		label: string;
		icon: string;
		desktopOnly?: boolean;
	}

	const tabs: TabDef[] = [
		{ id: 'grid', label: 'Curated Grid', icon: 'apps' },
		{ id: 'essays', label: 'Editorial Essays / Series', icon: 'document' },
		{ id: 'pinned', label: 'Pinned Collections', icon: 'bookmark', desktopOnly: true },
		{ id: 'critiques', label: 'Critiques', icon: 'document-signed', desktopOnly: true },
		{ id: 'saved', label: 'Saved', icon: 'bookmark' }
	];

	const viewModes: { id: ViewMode; label: string; icon: string }[] = [
		{ id: 'grid', label: 'Grid layout', icon: 'apps' },
		{ id: 'feed', label: 'Feed layout', icon: 'border-all' },
		{ id: 'compact', label: 'Compact layout', icon: 'menu-burger' }
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
	class="w-full select-none border-t sm:border-t-0 sm:border-b border-slate-200 dark:border-dark-border {className}"
>
	<div class="flex items-center justify-between sm:py-4">
		<!-- Tabs Bar (Mobile: 3 Icon Tabs / Desktop: Filter Pills) -->
		<div class="w-full sm:w-auto grid grid-cols-3 sm:flex sm:items-center gap-0 sm:gap-2">
			{#each tabs as tab (tab.id)}
				{@const isActive = activeTab === tab.id}
				<button
					type="button"
					class="relative cursor-pointer transition-all duration-150 border-0 {tab.desktopOnly
						? 'hidden sm:flex'
						: 'flex'} items-center justify-center h-12 sm:h-auto sm:px-4 sm:py-2 sm:rounded-full bg-transparent text-sm sm:text-xs font-semibold {isActive
						? 'text-slate-950 dark:text-white sm:bg-slate-950 sm:text-white sm:dark:bg-white sm:dark:text-slate-950 sm:shadow-xs'
						: 'text-slate-400 dark:text-dark-muted hover:text-slate-700 dark:hover:text-dark-text sm:hover:bg-slate-100 sm:dark:hover:bg-dark-elevated'}"
					onclick={() => selectTab(tab.id)}
					role="tab"
					aria-selected={isActive}
					aria-label={tab.label}
				>
					<!-- Mobile Icon -->
					<Icon name={tab.icon} class="text-lg sm:hidden" />

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
