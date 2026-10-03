<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { readApiError } from '$lib/utils/api-error';
	import { toast } from '$lib/utils/toast.svelte';
	import { m } from '$lib/i18n';
	import SettingsSection from './SettingsSection.svelte';
	import {
		buttonClass,
		dangerButtonClass,
		errorClass,
		fieldClass,
		hintClass,
		inputClass,
		panelClass,
		rowClass
	} from './styles';

	interface Props {
		/** Email/password accounts confirm deletion with their password. */
		hasPassword: boolean;
	}

	let { hasPassword }: Props = $props();

	let exporting = $state(false);

	async function downloadData() {
		exporting = true;
		try {
			const res = await fetch('/api/account/export');
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				toast.error(readApiError(body, m.settings_export_error()).message);
				return;
			}
			const name =
				/filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ??
				'kizuna-data.json';
			const href = URL.createObjectURL(await res.blob());
			const a = document.createElement('a');
			a.href = href;
			a.download = name;
			a.click();
			URL.revokeObjectURL(href);
			toast.success(m.settings_export_started());
		} catch {
			toast.error(m.settings_export_error());
		} finally {
			exporting = false;
		}
	}

	let deleteOpen = $state(false);
	let deleteConfirm = $state('');
	let deletePassword = $state('');
	let deleteError = $state('');
	let deleting = $state(false);
	const canDelete = $derived(
		deleteConfirm === 'DELETE' && (!hasPassword || deletePassword.length > 0) && !deleting
	);

	function closeDelete() {
		deleteOpen = false;
		deleteConfirm = '';
		deletePassword = '';
		deleteError = '';
	}

	async function deleteAccount(event: SubmitEvent) {
		event.preventDefault();
		if (!canDelete) return;
		deleting = true;
		deleteError = '';
		try {
			const res = await fetch('/api/account', {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					confirm: deleteConfirm,
					...(hasPassword ? { password: deletePassword } : {})
				})
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				deleteError = readApiError(body, m.settings_delete_error()).message;
				return;
			}
			toast.success(m.settings_deleted());
			// Sessions were deleted with the account; a full load drops any cached signed-in state.
			await goto(resolve('/'), { invalidateAll: true });
		} catch {
			deleteError = m.settings_delete_error();
		} finally {
			deleting = false;
		}
	}
</script>

<SettingsSection id="settings-data" title={m.settings_data()}>
	<div class={rowClass}>
		<div class="flex flex-col min-w-0">
			<span>{m.settings_download_data()}</span>
			<span class={hintClass}>{m.settings_download_data_hint()}</span>
		</div>
		<button
			type="button"
			class={buttonClass}
			onclick={downloadData}
			disabled={exporting}
			aria-busy={exporting}
		>
			{exporting ? m.settings_preparing() : m.settings_download()}
		</button>
	</div>
	<div class={rowClass}>
		<div class="flex flex-col min-w-0">
			<span class="text-red-600 dark:text-red-400">{m.settings_delete_account()}</span>
			<span class={hintClass}>{m.settings_delete_account_hint()}</span>
		</div>
		<button
			type="button"
			class={dangerButtonClass}
			onclick={() => (deleteOpen ? closeDelete() : (deleteOpen = true))}
			aria-expanded={deleteOpen}
			aria-controls="delete-account-panel"
		>
			{m.common_delete()}
		</button>
	</div>
	{#if deleteOpen}
		<form
			id="delete-account-panel"
			class="{panelClass} bg-red-50/50 dark:bg-red-950/20"
			onsubmit={deleteAccount}
		>
			<p class="m-0 text-sm text-slate-700 dark:text-dark-muted">
				{m.settings_delete_warning()}
			</p>
			<label class={fieldClass}>
				<span
					>{m.settings_delete_confirm_before()} <strong>DELETE</strong>
					{m.settings_delete_confirm_after()}</span
				>
				<input
					type="text"
					bind:value={deleteConfirm}
					autocomplete="off"
					autocapitalize="characters"
					spellcheck="false"
					class={inputClass}
				/>
			</label>
			{#if hasPassword}
				<label class={fieldClass}>
					<span>{m.settings_password()}</span>
					<input
						type="password"
						bind:value={deletePassword}
						autocomplete="current-password"
						class={inputClass}
					/>
				</label>
			{/if}
			{#if deleteError}
				<p class={errorClass} role="alert">{deleteError}</p>
			{/if}
			<div class="flex justify-end gap-2">
				<button type="button" class={buttonClass} onclick={closeDelete}>{m.common_cancel()}</button>
				<button
					type="submit"
					class="h-9 px-4 rounded-full text-xs font-semibold text-white bg-red-600 hover:bg-red-700 border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={!canDelete}
					aria-busy={deleting}
				>
					{deleting ? m.common_deleting() : m.settings_delete_my_account()}
				</button>
			</div>
		</form>
	{/if}
</SettingsSection>
