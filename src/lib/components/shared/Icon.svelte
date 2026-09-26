<script lang="ts">
	interface Props {
		/** Name of the uicon (e.g. "user", "lock", "eye", "sun", or full "fi-rr-lock") */
		name: string;
		/** Weight/style: 'rr' regular rounded (default), 'rs' regular straight, 'sr' solid rounded */
		type?: 'rr' | 'rs' | 'sr';
		/** Size preset or pixel number */
		size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
		/** Additional CSS classes */
		class?: string;
		[key: string]: unknown;
	}

	let { name, type = 'rr', size = 'md', class: className = '', ...restProps }: Props = $props();

	const sizeClasses: Record<string, string> = {
		xs: 'text-xs',
		sm: 'text-sm',
		md: 'text-base',
		lg: 'text-lg',
		xl: 'text-xl'
	};

	let iconClass = $derived(name.startsWith('fi-') ? name : `fi-${type}-${name}`);
</script>

<i
	class="fi {iconClass} inline-flex items-center justify-center leading-none select-none {typeof size ===
	'string'
		? sizeClasses[size] || ''
		: ''} {className}"
	style={typeof size === 'number' ? `font-size: ${size}px;` : undefined}
	aria-hidden="true"
	{...restProps}
></i>
