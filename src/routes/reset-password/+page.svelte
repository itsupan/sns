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
	import { m } from '$lib/i18n';

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
				errorMessage = error.message || m.auth_reset_error();
			} else {
				toast.success(m.auth_reset_done());
				await goto(resolve('/login'));
			}
		} catch {
			errorMessage = m.auth_reset_error();
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>{m.auth_reset_title()}</title>
	<meta name="description" content={m.auth_reset_description()} />
</svelte:head>

<main
	class="min-h-screen min-h-dvh flex flex-col justify-start sm:justify-center items-center pt-safe pb-safe px-0 sm:p-6 bg-white sm:bg-slate-50 dark:bg-dark-canvas transition-colors duration-200"
>
	<div class="w-full my-auto flex justify-center">
		<AuthPanel subtitle={m.auth_reset_subtitle()}>
			{#if invalid}
				<AuthAlert type="error">{m.auth_reset_link_invalid()}</AuthAlert>
				<p class="m-0 text-center text-[13px]">
					<a href={resolve('/forgot-password')} class={linkClass}>{m.auth_request_new_link()}</a>
				</p>
			{:else}
				{#if errorMessage}
					<AuthAlert type="error">{errorMessage}</AuthAlert>
				{/if}
				<form onsubmit={handleSubmit} class="flex flex-col gap-4.5" novalidate>
					<PasswordField
						id="new-password"
						name="newPassword"
						label={m.auth_new_password()}
						bind:value={newPassword}
						autocomplete="new-password"
					/>
					<PasswordField
						id="confirm-password"
						name="confirmPassword"
						label={m.auth_confirm_password()}
						bind:value={confirmPassword}
						autocomplete="new-password"
					/>
					<Button type="submit" variant="primary" size="lg" fullWidth {loading}>
						{m.auth_reset_password()}
					</Button>
				</form>
			{/if}
			<p class="mt-5 mb-0 text-center text-[13px]">
				<a href={resolve('/login')} class={linkClass}>{m.auth_back_to_log_in()}</a>
			</p>
		</AuthPanel>
	</div>
</main>
