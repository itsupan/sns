<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/shared/Icon.svelte';
	import ThemeToggle from '$lib/components/shared/ThemeToggle.svelte';
	import SettingsSection from './SettingsSection.svelte';
	import { linkRowClass, rowClass } from './styles';

	let { isModerator = false }: { isModerator?: boolean } = $props();
</script>

<SettingsSection id="settings-account" title="Account">
	<a href={resolve('/profile/edit')} class={linkRowClass}>
		<span>Edit profile</span>
		<Icon name="angle-right" class="text-slate-400" />
	</a>
	<div class={rowClass}>
		<span>Appearance</span>
		<ThemeToggle variant="segmented" />
	</div>
	{#if isModerator}
		<a href={resolve('/admin/reports')} class={linkRowClass}>
			<span>Moderation</span>
			<Icon name="angle-right" class="text-slate-400" />
		</a>
	{/if}
</SettingsSection>
