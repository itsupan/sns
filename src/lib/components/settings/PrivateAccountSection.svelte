<script lang="ts">
	import { readApiError } from '$lib/utils/api-error';
	import { toast } from '$lib/utils/toast.svelte';
	import SettingsSection from './SettingsSection.svelte';
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
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-labelledby="private-account-label"
			aria-describedby="private-account-hint"
			disabled={saving}
			onclick={toggle}
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
	</div>
</SettingsSection>
