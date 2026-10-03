<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { activityTypeLabels } from '$lib/activity/group';
	import type { ActivityType } from '$lib/activity/types';
	import { readApiError } from '$lib/utils/api-error';
	import { toast } from '$lib/utils/toast.svelte';
	import PushNotificationsToggle from './PushNotificationsToggle.svelte';
	import SettingsSection from './SettingsSection.svelte';
	import Switch from './Switch.svelte';
	import { rowClass } from './styles';

	const ENDPOINT = '/api/account/notification-preferences';

	// Every notification type in server order; null until loaded.
	let preferences = $state<Record<ActivityType, boolean> | null>(null);
	let loadFailed = $state(false);
	let saving = $state<ActivityType | null>(null);
	const entries = $derived(
		preferences ? (Object.entries(preferences) as [ActivityType, boolean][]) : []
	);

	onMount(async () => {
		try {
			const res = await fetch(ENDPOINT);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			preferences = await res.json();
		} catch {
			loadFailed = true;
		}
	});

	async function toggle(type: ActivityType) {
		if (!preferences) return;
		saving = type;
		try {
			const res = await fetch(ENDPOINT, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ [type]: !preferences[type] })
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				toast.error(readApiError(body, 'Could not update notifications').message);
				return;
			}
			preferences = body as Record<ActivityType, boolean>;
		} catch {
			toast.error('Could not update notifications');
		} finally {
			saving = null;
		}
	}
</script>

<SettingsSection id="settings-notifications" title="Notifications">
	{#if page.data.pushPublicKey}
		<PushNotificationsToggle publicKey={page.data.pushPublicKey} />
	{/if}
	{#each entries as [type, enabled] (type)}
		<div class={rowClass}>
			<span id="notification-pref-{type}">{activityTypeLabels[type]}</span>
			<Switch
				checked={enabled}
				disabled={saving === type}
				labelledby="notification-pref-{type}"
				onclick={() => toggle(type)}
			/>
		</div>
	{:else}
		<p class="{rowClass} m-0 text-sm text-slate-500 dark:text-dark-muted">
			{loadFailed ? 'Could not load your notification settings.' : 'Loading…'}
		</p>
	{/each}
</SettingsSection>
