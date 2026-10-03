<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import AuthAlert from '$lib/components/auth/AuthAlert.svelte';
	import AuthPanel from '$lib/components/auth/AuthPanel.svelte';
	import PasswordField from '$lib/components/auth/PasswordField.svelte';
	import { linkClass } from '$lib/components/auth/styles';
	import Button from '$lib/components/shared/Button.svelte';
	import { newPasswordError } from '$lib/utils/password';
	import { toast } from '$lib/utils/toast.svelte';

	// better-auth sends a valid email link here with `?token=`, and a stale one with `?error=`.
	const token = $derived(page.url.searchParams.get('token'));
	let rejected = $state(false);
	const invalid = $derived(!token || page.url.searchParams.has('error') || rejected);

	let newPassword = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!token) return;
		errorMessage = newPasswordError(newPassword, confirmPassword);
		if (errorMessage) return;
		loading = true;
		try {
			const { error } = await authClient.resetPassword({ newPassword, token });
			if (error?.code === 'INVALID_TOKEN') {
				rejected = true;
			} else if (error) {
				errorMessage = error.message || 'Could not reset your password. Please try again.';
			} else {
				toast.success('Your password has been reset. Log in with your new password.');
				await goto(resolve('/login'));
			}
		} catch {
			errorMessage = 'Could not reset your password. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Reset Password — Kizuna</title>
	<meta name="description" content="Choose a new password for your Kizuna account." />
</svelte:head>

<main
	class="min-h-screen min-h-dvh flex flex-col justify-start sm:justify-center items-center pt-safe pb-safe px-0 sm:p-6 bg-white sm:bg-slate-50 dark:bg-dark-canvas transition-colors duration-200"
>
	<div class="w-full my-auto flex justify-center">
		<AuthPanel subtitle="Choose a new password for your account.">
			{#if invalid}
				<AuthAlert type="error">This reset link is invalid or has expired.</AuthAlert>
				<p class="m-0 text-center text-[13px]">
					<a href={resolve('/forgot-password')} class={linkClass}>Request a new link</a>
				</p>
			{:else}
				{#if errorMessage}
					<AuthAlert type="error">{errorMessage}</AuthAlert>
				{/if}
				<form onsubmit={handleSubmit} class="flex flex-col gap-4.5" novalidate>
					<PasswordField
						id="new-password"
						name="newPassword"
						label="New password"
						bind:value={newPassword}
						autocomplete="new-password"
					/>
					<PasswordField
						id="confirm-password"
						name="confirmPassword"
						label="Confirm password"
						bind:value={confirmPassword}
						autocomplete="new-password"
					/>
					<Button type="submit" variant="primary" size="lg" fullWidth {loading}>
						Reset password
					</Button>
				</form>
			{/if}
			<p class="mt-5 mb-0 text-center text-[13px]">
				<a href={resolve('/login')} class={linkClass}>Back to log in</a>
			</p>
		</AuthPanel>
	</div>
</main>
