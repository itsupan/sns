<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { readApiError } from '$lib/utils/api-error';
	import { toast } from '$lib/utils/toast.svelte';
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
				toast.error(readApiError(body, 'Could not prepare your data').message);
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
			toast.success('Your data is downloading');
		} catch {
			toast.error('Could not prepare your data');
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
				deleteError = readApiError(body, 'Could not delete your account').message;
				return;
			}
			toast.success('Your account has been deleted');
			// Sessions were deleted with the account; a full load drops any cached signed-in state.
			await goto(resolve('/'), { invalidateAll: true });
		} catch {
			deleteError = 'Could not delete your account';
		} finally {
			deleting = false;
		}
	}
</script>

<SettingsSection id="settings-data" title="Privacy & data">
	<div class={rowClass}>
		<div class="flex flex-col min-w-0">
			<span>Download your data</span>
			<span class={hintClass}>Profile, posts, comments, follows and messages as a JSON file</span>
		</div>
		<button
			type="button"
			class={buttonClass}
			onclick={downloadData}
			disabled={exporting}
			aria-busy={exporting}
		>
			{exporting ? 'Preparing…' : 'Download'}
		</button>
	</div>
	<div class={rowClass}>
		<div class="flex flex-col min-w-0">
			<span class="text-red-600 dark:text-red-400">Delete account</span>
			<span class={hintClass}
				>Permanently removes your profile, posts, comments, follows and messages</span
			>
		</div>
		<button
			type="button"
			class={dangerButtonClass}
			onclick={() => (deleteOpen ? closeDelete() : (deleteOpen = true))}
			aria-expanded={deleteOpen}
			aria-controls="delete-account-panel"
		>
			Delete
		</button>
	</div>
	{#if deleteOpen}
		<form
			id="delete-account-panel"
			class="{panelClass} bg-red-50/50 dark:bg-red-950/20"
			onsubmit={deleteAccount}
		>
			<p class="m-0 text-sm text-slate-700 dark:text-dark-muted">
				This cannot be undone. Everything you have posted and your messages will be deleted for
				good. Download your data first if you want a copy.
			</p>
			<label class={fieldClass}>
				<span>Type <strong>DELETE</strong> to confirm</span>
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
					<span>Password</span>
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
				<button type="button" class={buttonClass} onclick={closeDelete}>Cancel</button>
				<button
					type="submit"
					class="h-9 px-4 rounded-full text-xs font-semibold text-white bg-red-600 hover:bg-red-700 border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={!canDelete}
					aria-busy={deleting}
				>
					{deleting ? 'Deleting…' : 'Delete my account'}
				</button>
			</div>
		</form>
	{/if}
</SettingsSection>
