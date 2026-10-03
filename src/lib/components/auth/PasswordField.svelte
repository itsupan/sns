<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { inputClass, labelClass } from './styles';

	interface Props {
		id: string;
		name: string;
		label: string;
		value: string;
		autocomplete: 'current-password' | 'new-password';
		/** Shown at the end of the label row, e.g. a "Forgot password?" link. */
		aside?: Snippet;
	}

	let { id, name, label, value = $bindable(), autocomplete, aside }: Props = $props();

	let visible = $state(false);
</script>

<div class="form-group flex flex-col gap-1.5">
	<div class="label-row flex justify-between items-center">
		<label for={id} class={labelClass}>{label}</label>
		{@render aside?.()}
	</div>
	<div class="password-input-wrapper relative flex items-center">
		<input
			{id}
			{name}
			type={visible ? 'text' : 'password'}
			bind:value
			placeholder="••••••••"
			required
			{autocomplete}
			enterkeyhint="go"
			class="{inputClass} password-input pr-11"
		/>
		<button
			type="button"
			class="toggle-password-btn absolute right-0.5 size-11 text-slate-500 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text transition-colors duration-150 flex items-center justify-center rounded-md cursor-pointer border-none bg-transparent"
			onclick={() => (visible = !visible)}
			aria-label="{visible ? 'Hide' : 'Show'} {label.toLowerCase()}"
		>
			<Icon name={visible ? 'eye-crossed' : 'eye'} size={19} />
		</button>
	</div>
</div>
