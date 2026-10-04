<script lang="ts">
	import { asset } from '$app/paths';
	import { m } from '$lib/i18n';

	interface Props {
		subtitle?: string;
		class?: string;
	}

	let { subtitle = m.common_tagline(), class: className = '' }: Props = $props();
</script>

<div class="kizuna-header flex flex-col items-center text-center mb-7 {className}">
	<div class="brand-identity flex items-center justify-center gap-3">
		<img
			src={asset('/brand/icon-192.png')}
			alt={m.common_logo_alt()}
			class="brand-logo size-12 rounded-full object-cover shrink-0 shadow-xs border border-black/10 dark:border-dark-border"
		/>
		<span
			class="brand-title text-2xl font-bold text-slate-950 dark:text-dark-text tracking-tight leading-none"
			>Kizuna</span
		>
	</div>

	{#if subtitle}
		<p
			class="brand-subtitle mt-3 text-sm leading-snug text-slate-500 dark:text-dark-muted max-w-[19.5rem] text-balance"
		>
			{subtitle}
		</p>
	{/if}
</div>
