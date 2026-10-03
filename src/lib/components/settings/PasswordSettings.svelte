<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { newPasswordError } from '$lib/utils/password';
	import { toast } from '$lib/utils/toast.svelte';
	import {
		buttonClass,
		errorClass,
		fieldClass,
		hintClass,
		inputClass,
		panelClass,
		primaryButtonClass,
		rowClass
	} from './styles';

	interface Props {
		hasPassword: boolean;
		/** Other ways the account signs in, e.g. `google`. */
		socialProviders: string[];
	}

	let { hasPassword, socialProviders }: Props = $props();

	const PROVIDER_NAMES: Record<string, string> = { google: 'Google' };
	const signInMethods = $derived(socialProviders.map((id) => PROVIDER_NAMES[id] ?? id).join(', '));

	let open = $state(false);
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let saving = $state(false);

	function close() {
		open = false;
		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
		error = '';
	}

	async function changePassword(event: SubmitEvent) {
		event.preventDefault();
		if (saving) return;
		error =
			(currentPassword
				? newPasswordError(newPassword, confirmPassword)
				: 'Please enter your current password.') ?? '';
		if (error) return;
		saving = true;
		try {
			const result = await authClient.changePassword({
				currentPassword,
				newPassword,
				revokeOtherSessions: true
			});
			if (result.error) {
				error =
					result.error.code === 'INVALID_PASSWORD'
						? 'Your current password is incorrect.'
						: result.error.message || 'Could not change your password';
				return;
			}
			toast.success('Password changed. Your other sessions were signed out.');
			close();
			// Every session was replaced, this one included.
			await invalidateAll();
		} catch {
			error = 'Could not change your password';
		} finally {
			saving = false;
		}
	}
</script>

{#if hasPassword}
	<div class={rowClass}>
		<span>Password</span>
		<button
			type="button"
			class={buttonClass}
			onclick={() => (open ? close() : (open = true))}
			aria-expanded={open}
			aria-controls="change-password-panel"
		>
			Change
		</button>
	</div>
	{#if open}
		<form id="change-password-panel" class={panelClass} onsubmit={changePassword} novalidate>
			<label class={fieldClass}>
				<span>Current password</span>
				<input
					type="password"
					bind:value={currentPassword}
					autocomplete="current-password"
					class={inputClass}
				/>
			</label>
			<label class={fieldClass}>
				<span>New password</span>
				<input
					type="password"
					bind:value={newPassword}
					autocomplete="new-password"
					class={inputClass}
				/>
			</label>
			<label class={fieldClass}>
				<span>Confirm new password</span>
				<input
					type="password"
					bind:value={confirmPassword}
					autocomplete="new-password"
					class={inputClass}
				/>
			</label>
			<p class="m-0 {hintClass}">Changing it signs you out everywhere else.</p>
			{#if error}
				<p class={errorClass} role="alert">{error}</p>
			{/if}
			<div class="flex justify-end gap-2">
				<button type="button" class={buttonClass} onclick={close}>Cancel</button>
				<button type="submit" class={primaryButtonClass} disabled={saving} aria-busy={saving}>
					{saving ? 'Saving…' : 'Change password'}
				</button>
			</div>
		</form>
	{/if}
{:else}
	<div class={rowClass}>
		<span>Sign-in method</span>
		<span class="text-sm text-slate-500 dark:text-dark-muted">{signInMethods}</span>
	</div>
{/if}
