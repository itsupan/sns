<script lang="ts">
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import AuthAlert from '$lib/components/auth/AuthAlert.svelte';
	import AuthPanel from '$lib/components/auth/AuthPanel.svelte';
	import { inputClass, labelClass, linkClass } from '$lib/components/auth/styles';
	import Turnstile from '$lib/components/auth/Turnstile.svelte';
	import Button from '$lib/components/shared/Button.svelte';

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
			errorMessage = 'Please enter your email address.';
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
			if (error) errorMessage = error.message || 'Could not send the email. Please try again.';
			else sent = true;
		} catch {
			errorMessage = 'Could not send the email. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Forgot Password — Kizuna</title>
	<meta name="description" content="Reset the password for your Kizuna account." />
</svelte:head>

<main
	class="min-h-screen min-h-dvh flex flex-col justify-start sm:justify-center items-center pt-safe pb-safe px-0 sm:p-6 bg-white sm:bg-slate-50 dark:bg-dark-canvas transition-colors duration-200"
>
	<div class="w-full my-auto flex justify-center">
		<AuthPanel
			subtitle="Forgot your password? Enter your email and we'll send you a link to reset it."
		>
			{#if sent}
				<AuthAlert type="success">
					If an account exists for {email.trim()}, we've sent it a link to reset the password.
				</AuthAlert>
			{:else}
				{#if errorMessage}
					<AuthAlert type="error">{errorMessage}</AuthAlert>
				{/if}
				<form onsubmit={handleSubmit} class="flex flex-col gap-4.5" novalidate>
					<div class="form-group flex flex-col gap-1.5">
						<label for="email" class={labelClass}>Email address</label>
						<input
							id="email"
							name="email"
							type="email"
							bind:value={email}
							placeholder="elena.vance@studio.com"
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
						Send reset link
					</Button>
				</form>
			{/if}
			<p class="mt-5 mb-0 text-center text-[13px]">
				<a href={resolve('/login')} class={linkClass}>Back to log in</a>
			</p>
		</AuthPanel>
	</div>
</main>
