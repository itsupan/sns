<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ResolvedPathname } from '$app/types';

	export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
	export type ButtonSize = 'sm' | 'md' | 'lg';

	interface Props {
		variant?: ButtonVariant;
		size?: ButtonSize;
		loading?: boolean;
		fullWidth?: boolean;
		disabled?: boolean;
		type?: 'button' | 'submit' | 'reset';
		href?: ResolvedPathname;
		class?: string;
		children?: Snippet;
		onclick?: (event: MouseEvent) => void;
		[key: string]: unknown;
	}

	let {
		variant = 'primary',
		size = 'md',
		loading = false,
		fullWidth = false,
		disabled = false,
		type = 'button',
		href,
		class: className = '',
		children,
		onclick,
		...restProps
	}: Props = $props();

	let isDisabled = $derived(disabled || loading);

	const variantClasses: Record<ButtonVariant, string> = {
		primary:
			'bg-slate-950 text-white border border-slate-950 hover:bg-slate-800 hover:border-slate-800 active:bg-black dark:bg-black dark:text-white dark:border-dark-border dark:hover:bg-dark-canvas shadow-sm',
		secondary:
			'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 dark:bg-dark-elevated dark:text-dark-text dark:border-dark-input-border dark:hover:bg-dark-hover shadow-xs',
		outline:
			'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 dark:bg-transparent dark:text-dark-text dark:border-dark-border dark:hover:bg-dark-elevated shadow-xs',
		ghost:
			'bg-transparent text-slate-600 border border-transparent hover:bg-slate-100 hover:text-slate-900 dark:text-dark-muted dark:hover:bg-dark-elevated dark:hover:text-dark-text',
		danger:
			'bg-red-600 text-white border border-red-600 hover:bg-red-700 hover:border-red-700 active:bg-red-800 dark:bg-red-600 dark:border-red-600 dark:hover:bg-red-700 shadow-sm'
	};

	const sizeClasses: Record<ButtonSize, string> = {
		sm: 'h-9 px-3.5 text-xs',
		md: 'h-11 px-4.5 text-sm',
		lg: 'h-12 px-5.5 text-[0.9375rem]'
	};
</script>

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a
		{href}
		class="btn btn-{variant} btn-{size} inline-flex items-center justify-center gap-2 font-semibold no-underline rounded-[10px] cursor-pointer transition-all duration-150 select-none whitespace-nowrap leading-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 dark:focus-visible:outline-kizuna-blue {variantClasses[
			variant
		]} {sizeClasses[size]} {fullWidth ? 'btn-full w-full' : ''} {isDisabled
			? 'btn-disabled opacity-55 cursor-not-allowed pointer-events-none shadow-none'
			: ''} {className}"
		aria-disabled={isDisabled}
		tabindex={isDisabled ? -1 : undefined}
		{onclick}
		{...restProps}
	>
		{#if loading}
			<span
				class="spinner inline-block size-4 border-2 border-current border-r-transparent rounded-full animate-spin shrink-0"
				aria-hidden="true"
			></span>
		{/if}
		{@render children?.()}
	</a>
{:else}
	<button
		{type}
		disabled={isDisabled}
		class="btn btn-{variant} btn-{size} inline-flex items-center justify-center gap-2 font-semibold no-underline rounded-[10px] cursor-pointer transition-all duration-150 select-none whitespace-nowrap leading-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 dark:focus-visible:outline-kizuna-blue {variantClasses[
			variant
		]} {sizeClasses[size]} {fullWidth ? 'btn-full w-full' : ''} {isDisabled
			? 'opacity-55 cursor-not-allowed pointer-events-none shadow-none'
			: ''} {loading ? 'btn-loading' : ''} {className}"
		{onclick}
		{...restProps}
	>
		{#if loading}
			<span
				class="spinner inline-block size-4 border-2 border-current border-r-transparent rounded-full animate-spin shrink-0"
				aria-hidden="true"
			></span>
		{/if}
		{@render children?.()}
	</button>
{/if}
