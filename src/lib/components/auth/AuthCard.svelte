<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import { MIN_AGE } from '$lib/constants/legal';
	import { emailVerifiedUrl } from '$lib/utils/email-links';
	import { newPasswordError } from '$lib/utils/password';
	import { toast } from '$lib/utils/toast.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import AuthAlert from './AuthAlert.svelte';
	import AuthPanel from './AuthPanel.svelte';
	import PasswordField from './PasswordField.svelte';
	import { inputClass, labelClass, linkClass } from './styles';

	interface Props {
		mode?: 'login' | 'signup';
		redirectTo?: string;
	}

	let { mode = $bindable('login'), redirectTo = '/' }: Props = $props();

	let effectiveRedirect = $derived(page.url?.searchParams?.get('redirectTo') || redirectTo);

	let name = $state('');
	let email = $state(page.url?.searchParams?.get('email') || '');
	let password = $state('');
	let confirmPassword = $state('');
	let rememberMe = $state(true);
	let agreeToTerms = $state(false);

	let loading = $state(false);
	let googleLoading = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	$effect(() => {
		const paramEmail = page.url?.searchParams?.get('email');
		if (paramEmail && !email) {
			email = paramEmail;
		}
	});

	function switchMode(newMode: 'login' | 'signup') {
		mode = newMode;
		errorMessage = null;
		successMessage = null;
		confirmPassword = '';

		if (typeof window !== 'undefined') {
			const targetPath = newMode === 'signup' ? resolve('/signup') : resolve('/login');
			if (window.location.pathname !== targetPath) {
				const query = email.trim() ? `?email=${encodeURIComponent(email.trim())}` : '';
				// eslint-disable-next-line svelte/no-navigation-without-resolve
				goto(`${targetPath}${query}`, { replaceState: true, noScroll: true, keepFocus: true });
			}
		}
	}

	async function handleGoogleSignIn() {
		errorMessage = null;
		googleLoading = true;
		try {
			await authClient.signIn.social({
				provider: 'google',
				callbackURL: effectiveRedirect
			});
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Google authentication failed';
			errorMessage = msg;
			toast.error(msg);
			googleLoading = false;
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = null;
		successMessage = null;

		const trimmedEmail = email.trim();
		const trimmedName = name.trim();

		if (!trimmedEmail || !password) {
			errorMessage = 'Please fill in all required fields.';
			toast.error(errorMessage);
			return;
		}

		if (mode === 'signup') {
			if (!trimmedName) {
				errorMessage = 'Please enter your name.';
				toast.error(errorMessage);
				return;
			}

			const passwordError = newPasswordError(password, confirmPassword);
			if (passwordError) {
				errorMessage = passwordError;
				toast.error(errorMessage);
				return;
			}

			if (!agreeToTerms) {
				errorMessage = `Please confirm you're ${MIN_AGE} or older and agree to the Terms to continue.`;
				toast.error(errorMessage);
				return;
			}
		}

		loading = true;

		try {
			if (mode === 'login') {
				const result = await authClient.signIn.email({
					email: trimmedEmail,
					password,
					rememberMe,
					callbackURL: effectiveRedirect
				});

				if (result.error) {
					errorMessage = result.error.message || 'Invalid email or password. Please try again.';
					toast.error(errorMessage);
					loading = false;
				} else {
					successMessage = 'Signed in successfully! Redirecting...';
					toast.success('Signed in successfully! Welcome back.');
					setTimeout(() => {
						// eslint-disable-next-line svelte/no-navigation-without-resolve
						goto(effectiveRedirect);
					}, 350);
				}
			} else {
				const result = await authClient.signUp.email({
					email: trimmedEmail,
					password,
					name: trimmedName,
					callbackURL: emailVerifiedUrl
				});

				if (result.error) {
					errorMessage = result.error.message || 'Could not create account. Please try again.';
					toast.error(errorMessage);
					loading = false;
				} else {
					// Sign out immediately so user must sign in with their email and password first
					try {
						await authClient.signOut();
					} catch {
						// Ignore if not authenticated yet
					}

					successMessage =
						'Account created successfully! Please sign in with your email and password.';
					toast.success('Account created successfully! Please sign in.');

					// Redirect user to login with their email and redirectTo prefilled
					const redirectParam = page.url?.searchParams?.get('redirectTo');
					const loginUrl = redirectParam
						? `${resolve('/login')}?email=${encodeURIComponent(trimmedEmail)}&redirectTo=${encodeURIComponent(redirectParam)}`
						: `${resolve('/login')}?email=${encodeURIComponent(trimmedEmail)}`;
					setTimeout(() => {
						// eslint-disable-next-line svelte/no-navigation-without-resolve
						goto(loginUrl);
					}, 600);
				}
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
			errorMessage = msg;
			toast.error(msg);
			loading = false;
		}
	}
</script>

<AuthPanel>
	<!-- Segmented Tab Switcher (Log In / Sign Up) -->
	<div
		class="tab-switcher grid grid-cols-2 bg-[#f1f3f5] dark:bg-dark-elevated p-1 rounded-[10px] mb-5 gap-1 transition-colors duration-150"
		role="tablist"
		aria-label="Authentication Mode"
	>
		<button
			type="button"
			role="tab"
			aria-selected={mode === 'login'}
			class="tab-btn bg-transparent border-none rounded-lg py-2.5 text-sm font-medium text-slate-500 dark:text-dark-muted cursor-pointer transition-all duration-150 text-center hover:text-slate-900 dark:hover:text-dark-text {mode ===
			'login'
				? 'active !bg-white dark:!bg-dark-card !text-slate-900 dark:!text-dark-text !font-semibold shadow-xs'
				: ''}"
			onclick={() => switchMode('login')}
		>
			Log In
		</button>
		<button
			type="button"
			role="tab"
			aria-selected={mode === 'signup'}
			class="tab-btn bg-transparent border-none rounded-lg py-2.5 text-sm font-medium text-slate-500 dark:text-dark-muted cursor-pointer transition-all duration-150 text-center hover:text-slate-900 dark:hover:text-dark-text {mode ===
			'signup'
				? 'active !bg-white dark:!bg-dark-card !text-slate-900 dark:!text-dark-text !font-semibold shadow-xs'
				: ''}"
			onclick={() => switchMode('signup')}
		>
			Sign Up
		</button>
	</div>

	<!-- Social Logins (Google only, no Apple) -->
	<div class="social-section flex flex-col gap-2.5">
		<button
			type="button"
			class="google-btn w-full h-[46px] flex items-center justify-center gap-2.5 bg-white dark:bg-dark-elevated border border-slate-200 dark:border-dark-input-border rounded-[10px] text-sm font-medium text-slate-800 dark:text-dark-text hover:bg-slate-50 dark:hover:bg-dark-hover hover:border-slate-300 dark:hover:border-dark-hover disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-all duration-150 box-border shadow-xs"
			onclick={handleGoogleSignIn}
			disabled={googleLoading || loading}
			aria-label="Continue with Google"
		>
			{#if googleLoading}
				<span
					class="btn-spinner inline-block size-4 border-2 border-slate-400 border-r-slate-900 dark:border-r-white rounded-full animate-spin"
					aria-hidden="true"
				></span>
				<span>Connecting to Google...</span>
			{:else}
				<svg
					class="google-icon shrink-0"
					viewBox="0 0 24 24"
					width="20"
					height="20"
					aria-hidden="true"
				>
					<path
						fill="#4285F4"
						d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
					/>
					<path
						fill="#34A853"
						d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
					/>
					<path
						fill="#FBBC05"
						d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
					/>
					<path
						fill="#EA4335"
						d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
					/>
				</svg>
				<span class="google-btn-text font-medium">Continue with Google</span>
			{/if}
		</button>
	</div>

	<!-- Divider -->
	<div class="divider flex items-center my-5 gap-3" role="separator">
		<span class="divider-line flex-1 h-px bg-slate-200 dark:bg-dark-border"></span>
		<span
			class="divider-text text-[11px] font-semibold text-slate-400 dark:text-dark-muted tracking-wider uppercase whitespace-nowrap"
		>
			{mode === 'login' ? 'OR SIGN IN WITH EMAIL' : 'OR SIGN UP WITH EMAIL'}
		</span>
		<span class="divider-line flex-1 h-px bg-slate-200 dark:bg-dark-border"></span>
	</div>

	<!-- Alerts -->
	{#if errorMessage}
		<AuthAlert type="error">{errorMessage}</AuthAlert>
	{/if}

	{#if successMessage}
		<AuthAlert type="success">{successMessage}</AuthAlert>
	{/if}

	<!-- Auth Form -->
	<form onsubmit={handleSubmit} class="auth-form flex flex-col gap-4.5" novalidate>
		{#if mode === 'signup'}
			<div class="form-group flex flex-col gap-1.5">
				<label for="name" class={labelClass}>Full name</label>
				<input
					id="name"
					name="name"
					type="text"
					bind:value={name}
					placeholder="Elena Vance"
					required
					autocomplete="name"
					enterkeyhint="next"
					class={inputClass}
				/>
			</div>
		{/if}

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
				enterkeyhint="next"
				class={inputClass}
			/>
		</div>

		<PasswordField
			id="password"
			name="password"
			label="Password"
			bind:value={password}
			autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
		>
			{#snippet aside()}
				{#if mode === 'login'}
					<a href={resolve('/forgot-password')} class="text-[13px] {linkClass}">Forgot password?</a>
				{/if}
			{/snippet}
		</PasswordField>

		{#if mode === 'signup'}
			<PasswordField
				id="confirm-password"
				name="confirmPassword"
				label="Confirm password"
				bind:value={confirmPassword}
				autocomplete="new-password"
			/>
		{/if}

		<!-- Options Row (Remember me / Terms) -->
		<div
			class="options-row flex items-center justify-between -mt-0.5 mb-1 text-[13px] gap-2 flex-wrap sm:flex-nowrap"
		>
			{#if mode === 'login'}
				<label class="checkbox-container flex items-center gap-2 cursor-pointer select-none">
					<input
						type="checkbox"
						bind:checked={rememberMe}
						class="checkbox-input size-4 rounded border-slate-300 dark:border-dark-input-border dark:bg-dark-elevated accent-slate-950 dark:accent-kizuna-blue cursor-pointer"
					/>
					<span class="checkbox-label text-slate-600 dark:text-dark-muted text-[13px]"
						>Remember me</span
					>
				</label>
			{:else}
				<label class="checkbox-container flex items-center gap-2 cursor-pointer select-none">
					<input
						type="checkbox"
						bind:checked={agreeToTerms}
						class="checkbox-input size-4 rounded border-slate-300 dark:border-dark-input-border dark:bg-dark-elevated accent-slate-950 dark:accent-kizuna-blue cursor-pointer"
						required
					/>
					<span class="checkbox-label text-slate-600 dark:text-dark-muted text-[13px]"
						>I'm {MIN_AGE} or older and agree to the
						<a
							href={resolve('/legal/terms')}
							class="underline underline-offset-2 hover:text-slate-900 dark:hover:text-dark-text"
							target="_blank"
							rel="noopener">Terms</a
						>
						and
						<a
							href={resolve('/legal/privacy')}
							class="underline underline-offset-2 hover:text-slate-900 dark:hover:text-dark-text"
							target="_blank"
							rel="noopener">Privacy Policy</a
						></span
					>
				</label>
			{/if}
		</div>

		<!-- Primary Button Component (Black) -->
		<Button type="submit" variant="primary" size="lg" fullWidth {loading}>
			<span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
			<Icon
				name="arrow-right"
				class="arrow-icon ml-1 text-base transition-transform duration-150 group-hover:translate-x-0.5"
			/>
		</Button>
	</form>

	<!-- Bottom Switcher -->
	<div
		class="bottom-switch mt-5 text-center text-[13px] text-slate-600 dark:text-dark-muted flex items-center justify-center gap-1.5"
	>
		{#if mode === 'login'}
			<span>Don't have an account?</span>
			<button
				type="button"
				class="switch-link bg-transparent border-none p-0 text-inherit font-semibold text-slate-900 dark:text-dark-text cursor-pointer hover:underline hover:text-blue-600 dark:hover:text-kizuna-blue transition-colors duration-150"
				onclick={() => switchMode('signup')}
			>
				Sign up
			</button>
		{:else}
			<span>Already have an account?</span>
			<button
				type="button"
				class="switch-link bg-transparent border-none p-0 text-inherit font-semibold text-slate-900 dark:text-dark-text cursor-pointer hover:underline hover:text-blue-600 dark:hover:text-kizuna-blue transition-colors duration-150"
				onclick={() => switchMode('login')}
			>
				Log in
			</button>
		{/if}
	</div>

	<!-- Footer Disclaimer (signup already has an explicit Terms checkbox) -->
	{#if mode === 'login'}
		<p
			class="footer-disclaimer mt-4.5 text-xs leading-relaxed text-slate-500 dark:text-dark-subtle text-center max-w-[20rem] mx-auto"
		>
			By continuing, you agree to Kizuna's
			<a
				href={resolve('/legal/terms')}
				class="underline underline-offset-2 hover:text-slate-900 dark:hover:text-dark-text"
				target="_blank"
				rel="noopener">Terms of Service</a
			>
			and
			<a
				href={resolve('/legal/privacy')}
				class="underline underline-offset-2 hover:text-slate-900 dark:hover:text-dark-text"
				target="_blank"
				rel="noopener">Privacy Policy</a
			>.
		</p>
	{/if}
</AuthPanel>
