<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		icon: string;
		label: string;
		danger?: boolean;
		onclick?: () => void;
	}

	let { icon, label, danger = false, onclick }: Props = $props();
</script>

<button
	type="button"
	class="w-full flex items-center gap-4 min-h-12 px-4 rounded-2xl text-[15px] font-medium text-left border-0 bg-transparent cursor-pointer transition-colors active:bg-slate-100 dark:active:bg-dark-elevated hover:bg-slate-50 dark:hover:bg-dark-elevated {danger
		? 'text-red-600 dark:text-red-400'
		: 'text-slate-900 dark:text-dark-text'}"
	{onclick}
>
	<Icon name={icon} class="text-lg" />
	<span>{label}</span>
</button>
