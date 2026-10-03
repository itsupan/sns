<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/shared/Icon.svelte';
	import ThemeToggle from '$lib/components/shared/ThemeToggle.svelte';
	import { m } from '$lib/i18n';
	import SettingsSection from './SettingsSection.svelte';
	import { linkRowClass, rowClass } from './styles';

	let { isModerator = false }: { isModerator?: boolean } = $props();
</script>

<SettingsSection id="settings-account" title={m.settings_account()}>
	<a href={resolve('/profile/edit')} class={linkRowClass}>
		<span>{m.settings_edit_profile()}</span>
		<Icon name="angle-right" class="text-slate-400" />
	</a>
	<div class={rowClass}>
		<span>{m.settings_appearance()}</span>
		<ThemeToggle variant="segmented" />
	</div>
	{#if isModerator}
		<a href={resolve('/admin/reports')} class={linkRowClass}>
			<span>{m.settings_moderation()}</span>
			<Icon name="angle-right" class="text-slate-400" />
		</a>
	{/if}
</SettingsSection>
