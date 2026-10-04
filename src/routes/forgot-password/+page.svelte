<script lang="ts">
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import AuthAlert from '$lib/components/auth/AuthAlert.svelte';
	import AuthPanel from '$lib/components/auth/AuthPanel.svelte';
	import { inputClass, labelClass, linkClass } from '$lib/components/auth/styles';
	import Turnstile from '$lib/components/auth/Turnstile.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { m } from '$lib/i18n';

	let email = $state('');
	let loading = $state(false);
	let sent = $state(false);
	let errorMessage = $state<string | null>(null);
	let captchaToken = $state('');
	let turnstile = $state<ReturnType<typeof Turnstile>>();

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const trimmedEmail = email.trim();
		if (!trimmedEmail) {
			errorMessage = m.auth_enter_email();
			return;
		}
		errorMessage = null;
		loading = true;
		try {
			// The answer is the same whether or not an account exists, so neither is the message.
			const { error } = await authClient.requestPasswordReset({
				email: trimmedEmail,
				redirectTo: resolve('/reset-password'),
				fetchOptions: { headers: { 'x-captcha-response': captchaToken } }
			});
			turnstile?.reset();
			if (error) errorMessage = error.message || m.auth_reset_email_error();
			else sent = true;
		} catch {
			errorMessage = m.auth_reset_email_error();
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>{m.auth_forgot_title()}</title>
	<meta name="description" content={m.auth_forgot_description()} />
</svelte:head>

<main
	class="min-h-screen min-h-dvh flex flex-col justify-start sm:justify-center items-center pt-safe pb-safe px-0 sm:p-6 bg-white sm:bg-slate-50 dark:bg-dark-canvas transition-colors duration-200"
>
	<div class="w-full my-auto flex justify-center">
		<AuthPanel subtitle={m.auth_forgot_subtitle()}>
			{#if sent}
				<AuthAlert type="success">
					{m.auth_reset_link_sent(email.trim())}
				</AuthAlert>
			{:else}
				{#if errorMessage}
					<AuthAlert type="error">{errorMessage}</AuthAlert>
				{/if}
				<form onsubmit={handleSubmit} class="flex flex-col gap-4.5" novalidate>
					<div class="form-group flex flex-col gap-1.5">
						<label for="email" class={labelClass}>{m.auth_email()}</label>
						<input
							id="email"
							name="email"
							type="email"
							bind:value={email}
							placeholder={m.auth_email_placeholder()}
							required
							autocomplete="email"
							inputmode="email"
							autocapitalize="off"
							enterkeyhint="send"
							class={inputClass}
						/>
					</div>
					<Turnstile bind:token={captchaToken} bind:this={turnstile} />
					<Button type="submit" variant="primary" size="lg" fullWidth {loading}>
						{m.auth_send_reset_link()}
					</Button>
				</form>
			{/if}
			<p class="mt-5 mb-0 text-center text-[13px]">
				<a href={resolve('/login')} class={linkClass}>{m.auth_back_to_log_in()}</a>
			</p>
		</AuthPanel>
	</div>
</main>
