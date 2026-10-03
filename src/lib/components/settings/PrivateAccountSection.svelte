<script lang="ts">
	import { readApiError } from '$lib/utils/api-error';
	import { toast } from '$lib/utils/toast.svelte';
	import SettingsSection from './SettingsSection.svelte';
	import Switch from './Switch.svelte';
	import { hintClass, rowClass } from './styles';

	interface Props {
		userId: string;
		isPrivate: boolean;
	}

	let { userId, isPrivate }: Props = $props();

	// Changed in this visit; the next load brings the saved value back in `isPrivate`.
	let override = $state<boolean | null>(null);
	let saving = $state(false);
	const checked = $derived(override ?? isPrivate);

	async function toggle() {
		const next = !checked;
		saving = true;
		try {
			const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isPrivate: next })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				toast.error(readApiError(body, 'Could not update your account').message);
				return;
			}
			override = next;
			toast.success(next ? 'Your account is now private' : 'Your account is now public');
		} catch {
			toast.error('Could not update your account');
		} finally {
			saving = false;
		}
	}
</script>

<SettingsSection id="settings-privacy" title="Account privacy">
	<div class={rowClass}>
		<span class="flex flex-col min-w-0">
			<span id="private-account-label">Private account</span>
			<span id="private-account-hint" class={hintClass}>
				Only people you approve can follow you and see your posts. Going public approves everyone
				waiting.
			</span>
		</span>
		<Switch
			{checked}
			disabled={saving}
			labelledby="private-account-label"
			describedby="private-account-hint"
			onclick={toggle}
		/>
	</div>
</SettingsSection>
