<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { emailChangedUrl, emailLinkResult, emailVerifiedUrl } from '$lib/utils/email-links';
	import { toast } from '$lib/utils/toast.svelte';
	import {
		buttonClass,
		errorClass,
		fieldClass,
		hintClass,
		inputClass,
		panelClass,
		primaryButtonClass,
		rowClass
	} from './styles';

	interface Props {
		email: string;
		emailVerified: boolean;
	}

	let { email, emailVerified }: Props = $props();

	onMount(() => {
		const result = emailLinkResult(page.url.searchParams, email);
		if (!result) return;
		toast[result.type](result.text);
		// Drop the query, so reloading the page does not repeat the message.
		goto(resolve('/settings'), { replaceState: true, noScroll: true, keepFocus: true });
	});

	let resending = $state(false);

	async function resendVerification() {
		resending = true;
		try {
			const { error } = await authClient.sendVerificationEmail({
				email,
				callbackURL: emailVerifiedUrl
			});
			if (error) toast.error(error.message || 'Could not send the email');
			else toast.success(`We sent a verification link to ${email}`);
		} catch {
			toast.error('Could not send the email');
		} finally {
			resending = false;
		}
	}

	let changeOpen = $state(false);
	let newEmail = $state('');
	let changeError = $state('');
	let changing = $state(false);

	function closeChange() {
		changeOpen = false;
		newEmail = '';
		changeError = '';
	}

	async function changeEmail(event: SubmitEvent) {
		event.preventDefault();
		const target = newEmail.trim();
		if (!target || changing) return;
		changing = true;
		changeError = '';
		try {
			const { error } = await authClient.changeEmail({
				newEmail: target,
				callbackURL: emailChangedUrl(target)
			});
			if (error) {
				changeError = error.message || 'Could not change your email';
				return;
			}
			toast.success(
				emailVerified
					? `Check ${email} for a link to approve the change`
					: `Check ${target} for a link to confirm it`
			);
			closeChange();
		} catch {
			changeError = 'Could not change your email';
		} finally {
			changing = false;
		}
	}
</script>

{#if !emailVerified}
	<div
		class="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
	>
		<Icon name="exclamation" class="mt-0.5 shrink-0" />
		<div class="flex flex-col items-start gap-2 min-w-0">
			<p class="m-0 text-sm">
				Your email address isn't verified yet. Open the link we email you to confirm it's yours.
			</p>
			<button
				type="button"
				class={buttonClass}
				onclick={resendVerification}
				disabled={resending}
				aria-busy={resending}
			>
				{resending ? 'Sending…' : 'Resend verification email'}
			</button>
		</div>
	</div>
{/if}
<div class={rowClass}>
	<div class="flex flex-col min-w-0">
		<span>Email</span>
		<span class="{hintClass} truncate">
			{email} ·
			{#if emailVerified}
				<span class="text-emerald-700 dark:text-emerald-400">Verified</span>
			{:else}
				<span class="text-amber-700 dark:text-amber-400">Not verified</span>
			{/if}
		</span>
	</div>
	<button
		type="button"
		class={buttonClass}
		onclick={() => (changeOpen ? closeChange() : (changeOpen = true))}
		aria-expanded={changeOpen}
		aria-controls="change-email-panel"
	>
		Change
	</button>
</div>
{#if changeOpen}
	<form id="change-email-panel" class={panelClass} onsubmit={changeEmail}>
		<p class="m-0 text-sm text-slate-700 dark:text-dark-muted">
			{#if emailVerified}
				We'll email {email} to approve the change, then send a link to the new address to finish.
			{:else}
				We'll send a link to the new address. Your email changes when you open it.
			{/if}
		</p>
		<label class={fieldClass}>
			<span>New email</span>
			<input
				type="email"
				bind:value={newEmail}
				autocomplete="email"
				inputmode="email"
				autocapitalize="off"
				required
				class={inputClass}
			/>
		</label>
		{#if changeError}
			<p class={errorClass} role="alert">{changeError}</p>
		{/if}
		<div class="flex justify-end gap-2">
			<button type="button" class={buttonClass} onclick={closeChange}>Cancel</button>
			<button
				type="submit"
				class={primaryButtonClass}
				disabled={!newEmail.trim() || changing}
				aria-busy={changing}
			>
				{changing ? 'Sending…' : 'Send link'}
			</button>
		</div>
	</form>
{/if}
