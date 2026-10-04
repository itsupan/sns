<script lang="ts">
	import { encode } from 'uqr';
	import { invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
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
		enable: 'Continue',
		disable: 'Turn off',
		regenerate: 'Create new codes'
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
			? 'Your password is incorrect.'
			: err.message || fallback;
	}

	async function confirmPassword(event: SubmitEvent) {
		event.preventDefault();
		if (busy || !action) return;
		if (!password) {
			error = 'Please enter your password.';
			return;
		}
		error = '';
		busy = true;
		try {
			if (action === 'enable') {
				const { data, error: err } = await authClient.twoFactor.enable({ password });
				if (err) {
					error = failure(err, 'Could not set up two-factor authentication');
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
					error = failure(err, 'Could not create new backup codes');
					return;
				}
				backupCodes = data.backupCodes;
				stage = 'codes';
				toast.success('New backup codes created. The old ones no longer work.');
			} else {
				const { error: err } = await authClient.twoFactor.disable({ password });
				if (err) {
					error = failure(err, 'Could not turn off two-factor authentication');
					return;
				}
				close();
				toast.success('Two-factor authentication is off');
				await invalidateAll();
			}
			password = '';
		} catch {
			error = 'Something went wrong. Please try again.';
		} finally {
			busy = false;
		}
	}

	async function verifyCode(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;
		const trimmedCode = code.replace(/\s/g, '');
		if (!/^\d{6}$/.test(trimmedCode)) {
			error = 'Enter the 6-digit code from your authenticator app.';
			return;
		}
		error = '';
		busy = true;
		try {
			const { error: err } = await authClient.twoFactor.verifyTotp({ code: trimmedCode });
			if (err) {
				error =
					err.code === 'INVALID_CODE'
						? 'That code is not right. Check your app and try again.'
						: err.message || 'Could not verify the code';
				return;
			}
			totpURI = '';
			code = '';
			stage = 'codes';
			toast.success('Two-factor authentication is on');
			// Turning it on replaced this session with one that carries the new setting.
			await invalidateAll();
		} catch {
			error = 'Could not verify the code';
		} finally {
			busy = false;
		}
	}

	async function copyCodes() {
		try {
			await navigator.clipboard.writeText(backupCodes.join('\n'));
			toast.success('Backup codes copied');
		} catch {
			toast.error('Could not copy. Select the codes and copy them yourself.');
		}
	}
</script>

{#if hasPassword}
	<SettingsSection id="settings-two-factor" title="Two-factor authentication">
		{#if enabled}
			<div class={rowClass}>
				<span class="flex flex-col min-w-0">
					<span>Authenticator app</span>
					<span class={hintClass}>On. Logging in with your password also asks for a code.</span>
				</span>
				<button
					type="button"
					class={dangerButtonClass}
					onclick={() => toggle('disable')}
					aria-expanded={action === 'disable'}
					aria-controls="two-factor-panel"
				>
					Turn off
				</button>
			</div>
			<div class={rowClass}>
				<span class="flex flex-col min-w-0">
					<span>Backup codes</span>
					<span class={hintClass}>One-time codes for when you cannot use your app</span>
				</span>
				<button
					type="button"
					class={buttonClass}
					onclick={() => toggle('regenerate')}
					aria-expanded={action === 'regenerate'}
					aria-controls="two-factor-panel"
				>
					Regenerate
				</button>
			</div>
		{:else}
			<div class={rowClass}>
				<span class="flex flex-col min-w-0">
					<span>Authenticator app</span>
					<span class={hintClass}>Ask for a code from your phone when you log in</span>
				</span>
				<button
					type="button"
					class={buttonClass}
					onclick={() => toggle('enable')}
					aria-expanded={action === 'enable'}
					aria-controls="two-factor-panel"
				>
					Turn on
				</button>
			</div>
		{/if}

		{#if action && stage === 'password'}
			<form id="two-factor-panel" class={panelClass} onsubmit={confirmPassword} novalidate>
				<label class={fieldClass}>
					<span>Confirm your password</span>
					<input
						type="password"
						bind:value={password}
						autocomplete="current-password"
						class={inputClass}
						{@attach focus}
					/>
				</label>
				{#if action === 'regenerate'}
					<p class="m-0 {hintClass}">Your current backup codes will stop working.</p>
				{:else if action === 'disable'}
					<p class="m-0 {hintClass}">Logging in will only ask for your password.</p>
				{/if}
				{#if error}
					<p class={errorClass} role="alert">{error}</p>
				{/if}
				<div class="flex justify-end gap-2">
					<button type="button" class={buttonClass} onclick={close}>Cancel</button>
					<button type="submit" class={primaryButtonClass} disabled={busy} aria-busy={busy}>
						{busy ? 'Checking…' : CONFIRM_LABELS[action]}
					</button>
				</div>
			</form>
		{:else if stage === 'scan' && qr}
			<form id="two-factor-panel" class={panelClass} onsubmit={verifyCode} novalidate>
				<p class="m-0 text-sm text-slate-700 dark:text-dark-muted">
					Scan this QR code with an authenticator app, such as Google Authenticator, 1Password or
					Authy, then enter the 6-digit code it shows.
				</p>
				<svg
					viewBox="0 0 {qr.size} {qr.size}"
					class="self-center size-48 rounded-lg bg-white"
					shape-rendering="crispEdges"
					role="img"
					aria-label="QR code for your authenticator app"
				>
					<path d={qrPath} fill="#000" />
				</svg>
				{#if setupKey}
					<p class="m-0 {hintClass}">
						Can't scan it? Enter this key instead:
						<code class="select-all break-all font-mono text-slate-900 dark:text-dark-text"
							>{setupKey}</code
						>
					</p>
				{/if}
				<label class={fieldClass}>
					<span>Code from the app</span>
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
					<button type="button" class={buttonClass} onclick={close}>Cancel</button>
					<button type="submit" class={primaryButtonClass} disabled={busy} aria-busy={busy}>
						{busy ? 'Verifying…' : 'Verify and turn on'}
					</button>
				</div>
			</form>
		{:else if stage === 'codes'}
			<div id="two-factor-panel" class={panelClass}>
				<p class="m-0 text-sm text-slate-700 dark:text-dark-muted" tabindex="-1" {@attach focus}>
					Save these backup codes somewhere safe. Each one logs you in once if you lose your phone.
					They will not be shown again.
				</p>
				<ul class="m-0 p-0 list-none grid grid-cols-2 gap-2 font-mono text-sm select-all">
					{#each backupCodes as backupCode (backupCode)}
						<li class="px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark-elevated text-center">
							{backupCode}
						</li>
					{/each}
				</ul>
				<div class="flex justify-end gap-2">
					<button type="button" class={buttonClass} onclick={copyCodes}>Copy</button>
					<button type="button" class={primaryButtonClass} onclick={close}>Done</button>
				</div>
			</div>
		{/if}
	</SettingsSection>
{/if}
