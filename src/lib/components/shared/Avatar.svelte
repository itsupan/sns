<script lang="ts">
	interface Props {
		/** Image source URL */
		src?: string | null;
		/** Accessible alt text */
		alt?: string;
		/** User name (used to generate monogram initials if image is missing) */
		name?: string;
		/** Size preset or numeric pixel value */
		size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
		/** Optional story / active ring */
		ring?: boolean | 'blue' | 'accent' | 'default';
		/** Optional activity indicator badge */
		status?: 'online' | 'offline' | 'busy' | 'none';
		/** Extra classes */
		class?: string;
		[key: string]: unknown;
	}

	let {
		src = null,
		alt = 'User avatar',
		name = '',
		size = 'md',
		ring = false,
		status = 'none',
		class: className = '',
		...restProps
	}: Props = $props();

	let imageError = $state(false);

	const sizeClasses: Record<string, { container: string; text: string; badge: string }> = {
		xs: { container: 'size-6', text: 'text-[10px]', badge: 'size-1.5' },
		sm: { container: 'size-8', text: 'text-xs', badge: 'size-2' },
		md: { container: 'size-10', text: 'text-sm', badge: 'size-2.5' },
		lg: { container: 'size-12', text: 'text-base', badge: 'size-3' },
		xl: { container: 'size-14', text: 'text-lg', badge: 'size-3.5' },
		'2xl': { container: 'size-16', text: 'text-xl', badge: 'size-4' }
	};

	let initials = $derived(
		name
			? name
					.split(' ')
					.filter(Boolean)
					.map((part) => part[0]?.toUpperCase())
					.slice(0, 2)
					.join('')
			: ''
	);

	let ringClass = $derived.by(() => {
		if (!ring) return '';
		if (ring === 'blue' || ring === true) {
			return 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-dark-card';
		}
		if (ring === 'accent') {
			return 'ring-2 ring-slate-900 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-dark-card';
		}
		return 'ring-1 ring-slate-200 dark:ring-dark-border';
	});

	let statusBg = $derived.by(() => {
		switch (status) {
			case 'online':
				return 'bg-emerald-500';
			case 'busy':
				return 'bg-rose-500';
			case 'offline':
				return 'bg-slate-400';
			default:
				return '';
		}
	});

	const preset = $derived(typeof size === 'string' ? sizeClasses[size] || sizeClasses.md : null);
</script>

<div
	class="relative inline-flex shrink-0 select-none {preset?.container || ''} {className}"
	style={typeof size === 'number' ? `width: ${size}px; height: ${size}px;` : undefined}
	{...restProps}
>
	<div
		class="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-text font-semibold {ringClass} transition-all duration-150"
	>
		{#if src && !imageError}
			<img
				{src}
				{alt}
				onerror={() => (imageError = true)}
				class="w-full h-full object-cover rounded-full"
			/>
		{:else if initials}
			<span class={preset?.text || 'text-sm'}>{initials}</span>
		{:else}
			<!-- Default abstract avatar placeholder -->
			<svg
				class="w-3/5 h-3/5 text-slate-400 dark:text-dark-subtle"
				viewBox="0 0 24 24"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
				/>
			</svg>
		{/if}
	</div>

	{#if status !== 'none'}
		<span
			class="absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-dark-card {preset?.badge ||
				'size-2.5'} {statusBg}"
			aria-hidden="true"
		></span>
	{/if}
</div>
