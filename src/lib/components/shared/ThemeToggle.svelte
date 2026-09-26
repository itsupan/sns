<script lang="ts">
	import { onMount } from 'svelte';
	import { themeManager } from '$lib/utils/theme.svelte';

	interface Props {
		class?: string;
		variant?: 'icon' | 'segmented';
	}

	let { class: className = '', variant = 'icon' }: Props = $props();

	onMount(() => {
		themeManager.init();
	});
</script>

{#if variant === 'icon'}
	<button
		type="button"
		class="theme-toggle inline-flex items-center justify-center size-9 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-600 dark:text-dark-text hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-dark-hover transition-all duration-150 cursor-pointer border border-slate-200/60 dark:border-dark-border {className}"
		onclick={() => themeManager.toggleTheme()}
		aria-label={themeManager.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
		title={themeManager.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
	>
		{#if themeManager.isDark}
			<!-- Sun Icon -->
			<svg
				viewBox="0 0 24 24"
				width="18"
				height="18"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="4" />
				<path
					d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
				/>
			</svg>
		{:else}
			<!-- Moon Icon -->
			<svg
				viewBox="0 0 24 24"
				width="18"
				height="18"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
			</svg>
		{/if}
	</button>
{:else}
	<!-- Segmented (Light / System / Dark) -->
	<div
		class="inline-flex items-center p-1 bg-slate-100 dark:bg-dark-elevated rounded-lg border border-slate-200 dark:border-dark-border text-xs {className}"
		role="radiogroup"
		aria-label="Theme mode"
	>
		<button
			type="button"
			role="radio"
			aria-checked={themeManager.theme === 'light'}
			class="px-2.5 py-1 rounded-md font-medium transition-all duration-150 cursor-pointer {themeManager.theme ===
			'light'
				? 'bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text shadow-xs font-semibold'
				: 'text-slate-500 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text'}"
			onclick={() => themeManager.setTheme('light')}
		>
			Light
		</button>
		<button
			type="button"
			role="radio"
			aria-checked={themeManager.theme === 'system'}
			class="px-2.5 py-1 rounded-md font-medium transition-all duration-150 cursor-pointer {themeManager.theme ===
			'system'
				? 'bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text shadow-xs font-semibold'
				: 'text-slate-500 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text'}"
			onclick={() => themeManager.setTheme('system')}
		>
			System
		</button>
		<button
			type="button"
			role="radio"
			aria-checked={themeManager.theme === 'dark'}
			class="px-2.5 py-1 rounded-md font-medium transition-all duration-150 cursor-pointer {themeManager.theme ===
			'dark'
				? 'bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text shadow-xs font-semibold'
				: 'text-slate-500 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text'}"
			onclick={() => themeManager.setTheme('dark')}
		>
			Dark
		</button>
	</div>
{/if}
