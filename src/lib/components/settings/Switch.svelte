<script lang="ts">
	interface Props {
		checked: boolean;
		disabled?: boolean;
		/** Id of the element naming the setting. */
		labelledby: string;
		/** Id of the element explaining the setting. */
		describedby?: string;
		onclick: () => void;
	}

	let { checked, disabled = false, labelledby, describedby, onclick }: Props = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	aria-labelledby={labelledby}
	aria-describedby={describedby}
	{disabled}
	{onclick}
	class="relative shrink-0 w-11 h-6 rounded-full border-0 cursor-pointer transition-colors disabled:opacity-60 {checked
		? 'bg-blue-600 dark:bg-kizuna-blue'
		: 'bg-slate-300 dark:bg-dark-elevated'}"
>
	<span
		class="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-xs transition-transform {checked
			? 'translate-x-5'
			: ''}"
		aria-hidden="true"
	></span>
</button>
