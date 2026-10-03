<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import EmailSettings from './EmailSettings.svelte';
	import PasswordSettings from './PasswordSettings.svelte';
	import SessionList from './SessionList.svelte';
	import SettingsSection from './SettingsSection.svelte';

	type Props = ComponentProps<typeof EmailSettings> &
		ComponentProps<typeof PasswordSettings> &
		ComponentProps<typeof SessionList>;

	let { email, emailVerified, hasPassword, socialProviders, sessions }: Props = $props();
</script>

<SettingsSection id="settings-security" title="Security">
	<EmailSettings {email} {emailVerified} />
	<PasswordSettings {hasPassword} {socialProviders} />
	<SessionList {sessions} />
</SettingsSection>
