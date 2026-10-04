<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import AuthAlert from '$lib/components/auth/AuthAlert.svelte';
	import AuthPanel from '$lib/components/auth/AuthPanel.svelte';
	import { inputClass, labelClass, linkClass } from '$lib/components/auth/styles';
	import Button from '$lib/components/shared/Button.svelte';
	import { toast } from '$lib/utils/toast.svelte';

	/** The pending sign-in is gone (expired, used up, or never started): only a new log in helps. */
	const EXPIRED_CODES = new Set([
		'INVALID_TWO_FACTOR_COOKIE',
		'TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE'
	]);

	const redirectTo = $derived(page.url.searchParams.get('redirectTo') || '/profile');
	const loginUrl = $derived(`${resolve('/login')}?redirectTo=${encodeURIComponent(redirectTo)}`);

	let useBackupCode = $state(false);
	let code = $state('');
	let trustDevice = $state(false);
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);
	let expired = $state(false);

	function toggleMethod() {
		useBackupCode = !useBackupCode;
		code = '';
		errorMessage = null;
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const trimmedCode = code.replace(/\s/g, '');
		if (!trimmedCode) {
			errorMessage = useBackupCode
				? 'Please enter one of your backup codes.'
				: 'Please enter the 6-digit code from your app.';
			return;
		}
		errorMessage = null;
		loading = true;
		try {
			const body = { code: trimmedCode, trustDevice };
			const { error } = useBackupCode
				? await authClient.twoFactor.verifyBackupCode(body)
				: await authClient.twoFactor.verifyTotp(body);
			if (error) {
				expired = EXPIRED_CODES.has(error.code ?? '');
				errorMessage = expired
					? 'This sign-in has expired. Please log in again.'
					: error.code === 'INVALID_CODE' || error.code === 'INVALID_BACKUP_CODE'
						? 'That code is not right. Please try again.'
						: error.message || 'Could not verify the code. Please try again.';
				loading = false;
				return;
			}
			toast.success('Signed in successfully! Welcome back.');
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto(redirectTo, { invalidateAll: true });
		} catch {
			errorMessage = 'Could not verify the code. Please try again.';
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Two-Factor Authentication — Kizuna</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main
	class="min-h-screen min-h-dvh flex flex-col justify-start sm:justify-center items-center pt-safe pb-safe px-0 sm:p-6 bg-white sm:bg-slate-50 dark:bg-dark-canvas transition-colors duration-200"
>
	<div class="w-full my-auto flex justify-center">
		<AuthPanel
			subtitle={useBackupCode
				? 'Enter one of the backup codes you saved when you turned on two-factor authentication.'
				: 'Enter the 6-digit code from your authenticator app.'}
		>
			{#if errorMessage}
				<AuthAlert type="error">{errorMessage}</AuthAlert>
			{/if}
			{#if !expired}
				<form onsubmit={handleSubmit} class="flex flex-col gap-4.5" novalidate>
					<div class="form-group flex flex-col gap-1.5">
						{#if useBackupCode}
							<label for="code" class={labelClass}>Backup code</label>
							<input
								id="code"
								name="code"
								type="text"
								bind:value={code}
								required
								autocomplete="off"
								autocapitalize="off"
								spellcheck="false"
								enterkeyhint="go"
								class={inputClass}
							/>
						{:else}
							<label for="code" class={labelClass}>Authentication code</label>
							<input
								id="code"
								name="code"
								type="text"
								bind:value={code}
								placeholder="123456"
								required
								autocomplete="one-time-code"
								inputmode="numeric"
								enterkeyhint="go"
								class="{inputClass} tracking-[0.3em]"
							/>
						{/if}
					</div>
					<label class="flex items-center gap-2 cursor-pointer select-none text-[13px]">
						<input
							type="checkbox"
							bind:checked={trustDevice}
							class="size-4 rounded border-slate-300 dark:border-dark-input-border dark:bg-dark-elevated accent-slate-950 dark:accent-kizuna-blue cursor-pointer"
						/>
						<span class="text-slate-600 dark:text-dark-muted">Trust this device for 30 days</span>
					</label>
					<Button type="submit" variant="primary" size="lg" fullWidth {loading}>Verify</Button>
				</form>
				<p class="mt-5 mb-0 text-center text-[13px]">
					<button
						type="button"
						class="bg-transparent border-none p-0 cursor-pointer {linkClass}"
						onclick={toggleMethod}
					>
						{useBackupCode ? 'Use your authenticator app instead' : 'Use a backup code instead'}
					</button>
				</p>
			{/if}
			<p class="mt-3 mb-0 text-center text-[13px]">
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href comes from resolve() -->
				<a href={loginUrl} class={linkClass}>Back to log in</a>
			</p>
		</AuthPanel>
	</div>
</main>
