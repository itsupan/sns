<script lang="ts">
	import { ICONS, OUTLINE_ONLY, type IconName } from './icons';

	interface Props {
		/** A name from the registry in `icons.ts` */
		name: IconName;
		/** 'rr' outline (default), 'sr' solid: filled, or drawn bolder where a fill would hide it */
		type?: 'rr' | 'sr';
		/** Size preset or pixel number; the icon is 1em square, so a text-size class sizes it too */
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

	let Glyph = $derived(ICONS[name]);
	let solid = $derived(type === 'sr');
	let filled = $derived(solid && !OUTLINE_ONLY.has(name));
</script>

<Glyph
	width="1em"
	height="1em"
	fill={filled ? 'currentColor' : 'none'}
	strokeWidth={solid && !filled ? 2.75 : 2}
	class="shrink-0 select-none {typeof size === 'string' ? sizeClasses[size] || '' : ''} {className}"
	style={typeof size === 'number' ? `font-size: ${size}px;` : undefined}
	aria-hidden="true"
	{...restProps}
/>
