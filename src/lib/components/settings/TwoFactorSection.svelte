<script lang="ts">
	import { encode } from 'uqr';
	import { invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
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
		primaryButtonClass,
		rowClass
	} from './styles';

	interface Props {
		/** Every change is confirmed with the password, so accounts without one never see this. */
		hasPassword: boolean;
		enabled: boolean;
	}

	let { hasPassword, enabled }: Props = $props();

	type Action = 'enable' | 'disable' | 'regenerate';

	const CONFIRM_LABELS: Record<Action, string> = {
		enable: m.settings_2fa_continue(),
		disable: m.settings_2fa_turn_off(),
		regenerate: m.settings_2fa_new_codes()
	};

	let action = $state<Action | null>(null);
	let stage = $state<'password' | 'scan' | 'codes'>('password');
	let password = $state('');
	let code = $state('');
	let totpURI = $state('');
	let backupCodes = $state<string[]>([]);
	let error = $state('');
	let busy = $state(false);

	const qr = $derived(totpURI ? encode(totpURI, { border: 2 }) : null);
	/** A unit square per dark module, all in one path. */
	const qrPath = $derived(
		qr?.data.flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : ''))).join('')
	);
	/** For apps that cannot scan: the same secret, typed in by hand. */
	const setupKey = $derived(totpURI ? new URL(totpURI).searchParams.get('secret') : null);

	const focus = (node: HTMLElement) => node.focus();

	function close() {
		action = null;
		stage = 'password';
		password = '';
		code = '';
		totpURI = '';
		backupCodes = [];
		error = '';
	}

	function toggle(next: Action) {
		const reopen = action !== next;
		close();
		if (reopen) action = next;
	}

	function failure(err: { code?: string; message?: string }, fallback: string) {
		return err.code === 'INVALID_PASSWORD'
			? m.settings_2fa_password_incorrect()
			: err.message || fallback;
	}

	async function confirmPassword(event: SubmitEvent) {
		event.preventDefault();
		if (busy || !action) return;
		if (!password) {
			error = m.settings_2fa_enter_password();
			return;
		}
		error = '';
		busy = true;
		try {
			if (action === 'enable') {
				const { data, error: err } = await authClient.twoFactor.enable({ password });
				if (err) {
					error = failure(err, m.settings_2fa_enable_error());
					return;
				}
				if (!('totpURI' in data)) {
					error = 'Could not set up two-factor authentication';
					return;
				}
				totpURI = data.totpURI;
				backupCodes = data.backupCodes;
				stage = 'scan';
			} else if (action === 'regenerate') {
				const { data, error: err } = await authClient.twoFactor.generateBackupCodes({ password });
				if (err) {
					error = failure(err, m.settings_2fa_codes_error());
					return;
				}
				backupCodes = data.backupCodes;
				stage = 'codes';
				toast.success(m.settings_2fa_codes_created());
			} else {
				const { error: err } = await authClient.twoFactor.disable({ password });
				if (err) {
					error = failure(err, m.settings_2fa_disable_error());
					return;
				}
				close();
				toast.success(m.settings_2fa_is_off());
				await invalidateAll();
			}
			password = '';
		} catch {
			error = m.common_something_wrong();
		} finally {
			busy = false;
		}
	}

	async function verifyCode(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;
		const trimmedCode = code.replace(/\s/g, '');
		if (!/^\d{6}$/.test(trimmedCode)) {
			error = m.settings_2fa_code_format();
			return;
		}
		error = '';
		busy = true;
		try {
			const { error: err } = await authClient.twoFactor.verifyTotp({ code: trimmedCode });
			if (err) {
				error =
					err.code === 'INVALID_CODE'
						? m.settings_2fa_code_wrong()
						: err.message || m.settings_2fa_verify_error();
				return;
			}
			totpURI = '';
			code = '';
			stage = 'codes';
			toast.success(m.settings_2fa_is_on());
			// Turning it on replaced this session with one that carries the new setting.
			await invalidateAll();
		} catch {
			error = m.settings_2fa_verify_error();
		} finally {
			busy = false;
		}
	}

	async function copyCodes() {
		try {
			await navigator.clipboard.writeText(backupCodes.join('\n'));
			toast.success(m.settings_2fa_codes_copied());
		} catch {
			toast.error(m.settings_2fa_copy_error());
		}
	}
</script>

{#if hasPassword}
	<SettingsSection id="settings-two-factor" title={m.settings_2fa()}>
		{#if enabled}
			<div class={rowClass}>
				<span class="flex flex-col min-w-0">
					<span>{m.settings_2fa_app()}</span>
					<span class={hintClass}>{m.settings_2fa_on_hint()}</span>
				</span>
				<button
					type="button"
					class={dangerButtonClass}
					onclick={() => toggle('disable')}
					aria-expanded={action === 'disable'}
					aria-controls="two-factor-panel"
				>
					{m.settings_2fa_turn_off()}
				</button>
			</div>
			<div class={rowClass}>
				<span class="flex flex-col min-w-0">
					<span>{m.settings_2fa_backup_codes()}</span>
					<span class={hintClass}>{m.settings_2fa_backup_codes_hint()}</span>
				</span>
				<button
					type="button"
					class={buttonClass}
					onclick={() => toggle('regenerate')}
					aria-expanded={action === 'regenerate'}
					aria-controls="two-factor-panel"
				>
					{m.settings_2fa_regenerate()}
				</button>
			</div>
		{:else}
			<div class={rowClass}>
				<span class="flex flex-col min-w-0">
					<span>{m.settings_2fa_app()}</span>
					<span class={hintClass}>{m.settings_2fa_off_hint()}</span>
				</span>
				<button
					type="button"
					class={buttonClass}
					onclick={() => toggle('enable')}
					aria-expanded={action === 'enable'}
					aria-controls="two-factor-panel"
				>
					{m.settings_2fa_turn_on()}
				</button>
			</div>
		{/if}

		{#if action && stage === 'password'}
			<form id="two-factor-panel" class={panelClass} onsubmit={confirmPassword} novalidate>
				<label class={fieldClass}>
					<span>{m.settings_2fa_confirm_password()}</span>
					<input
						type="password"
						bind:value={password}
						autocomplete="current-password"
						class={inputClass}
						{@attach focus}
					/>
				</label>
				{#if action === 'regenerate'}
					<p class="m-0 {hintClass}">{m.settings_2fa_regenerate_warning()}</p>
				{:else if action === 'disable'}
					<p class="m-0 {hintClass}">{m.settings_2fa_disable_warning()}</p>
				{/if}
				{#if error}
					<p class={errorClass} role="alert">{error}</p>
				{/if}
				<div class="flex justify-end gap-2">
					<button type="button" class={buttonClass} onclick={close}>{m.common_cancel()}</button>
					<button type="submit" class={primaryButtonClass} disabled={busy} aria-busy={busy}>
						{busy ? m.settings_2fa_checking() : CONFIRM_LABELS[action]}
					</button>
				</div>
			</form>
		{:else if stage === 'scan' && qr}
			<form id="two-factor-panel" class={panelClass} onsubmit={verifyCode} novalidate>
				<p class="m-0 text-sm text-slate-700 dark:text-dark-muted">
					{m.settings_2fa_scan()}
				</p>
				<svg
					viewBox="0 0 {qr.size} {qr.size}"
					class="self-center size-48 rounded-lg bg-white"
					shape-rendering="crispEdges"
					role="img"
					aria-label={m.settings_2fa_qr_label()}
				>
					<path d={qrPath} fill="#000" />
				</svg>
				{#if setupKey}
					<p class="m-0 {hintClass}">
						{m.settings_2fa_manual_key()}
						<code class="select-all break-all font-mono text-slate-900 dark:text-dark-text"
							>{setupKey}</code
						>
					</p>
				{/if}
				<label class={fieldClass}>
					<span>{m.settings_2fa_code()}</span>
					<input
						type="text"
						bind:value={code}
						inputmode="numeric"
						autocomplete="one-time-code"
						placeholder="123456"
						class={inputClass}
						{@attach focus}
					/>
				</label>
				{#if error}
					<p class={errorClass} role="alert">{error}</p>
				{/if}
				<div class="flex justify-end gap-2">
					<button type="button" class={buttonClass} onclick={close}>{m.common_cancel()}</button>
					<button type="submit" class={primaryButtonClass} disabled={busy} aria-busy={busy}>
						{busy ? m.settings_2fa_verifying() : m.settings_2fa_verify()}
					</button>
				</div>
			</form>
		{:else if stage === 'codes'}
			<div id="two-factor-panel" class={panelClass}>
				<p class="m-0 text-sm text-slate-700 dark:text-dark-muted" tabindex="-1" {@attach focus}>
					{m.settings_2fa_save_codes()}
				</p>
				<ul class="m-0 p-0 list-none grid grid-cols-2 gap-2 font-mono text-sm select-all">
					{#each backupCodes as backupCode (backupCode)}
						<li class="px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark-elevated text-center">
							{backupCode}
						</li>
					{/each}
				</ul>
				<div class="flex justify-end gap-2">
					<button type="button" class={buttonClass} onclick={copyCodes}>{m.common_copy()}</button>
					<button type="button" class={primaryButtonClass} onclick={close}>{m.common_done()}</button
					>
				</div>
			</div>
		{/if}
	</SettingsSection>
{/if}
