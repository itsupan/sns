<script lang="ts">
	import { resolve } from '$app/paths';
	import { LEGAL_LINKS } from '$lib/constants/legal';
	import Icon from '$lib/components/shared/Icon.svelte';
	import SettingsSection from './SettingsSection.svelte';
	import { linkRowClass } from './styles';
</script>

<SettingsSection id="settings-legal" title="About & legal">
	{#each LEGAL_LINKS as link (link.href)}
		<a href={resolve(link.href)} class={linkRowClass}>
			<span>{link.title}</span>
			<Icon name="angle-right" class="text-slate-400" />
		</a>
	{/each}
</SettingsSection>
