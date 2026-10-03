<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { emailChangedUrl, emailLinkResult, emailVerifiedUrl } from '$lib/utils/email-links';
	import { toast } from '$lib/utils/toast.svelte';
	import { m } from '$lib/i18n';
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
			if (error) toast.error(error.message || m.settings_email_send_error());
			else toast.success(m.settings_email_verification_sent(email));
		} catch {
			toast.error(m.settings_email_send_error());
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
				changeError = error.message || m.settings_email_change_error();
				return;
			}
			toast.success(
				emailVerified
					? m.settings_email_check_approve(email)
					: m.settings_email_check_confirm(target)
			);
			closeChange();
		} catch {
			changeError = m.settings_email_change_error();
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
				{m.settings_email_unverified_notice()}
			</p>
			<button
				type="button"
				class={buttonClass}
				onclick={resendVerification}
				disabled={resending}
				aria-busy={resending}
			>
				{resending ? m.common_sending() : m.settings_email_resend()}
			</button>
		</div>
	</div>
{/if}
<div class={rowClass}>
	<div class="flex flex-col min-w-0">
		<span>{m.settings_email()}</span>
		<span class="{hintClass} truncate">
			{email} ·
			{#if emailVerified}
				<span class="text-emerald-700 dark:text-emerald-400">{m.settings_email_verified()}</span>
			{:else}
				<span class="text-amber-700 dark:text-amber-400">{m.settings_email_not_verified()}</span>
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
		{m.common_change()}
	</button>
</div>
{#if changeOpen}
	<form id="change-email-panel" class={panelClass} onsubmit={changeEmail}>
		<p class="m-0 text-sm text-slate-700 dark:text-dark-muted">
			{#if emailVerified}
				{m.settings_email_change_verified(email)}
			{:else}
				{m.settings_email_change_unverified()}
			{/if}
		</p>
		<label class={fieldClass}>
			<span>{m.settings_new_email()}</span>
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
			<button type="button" class={buttonClass} onclick={closeChange}>{m.common_cancel()}</button>
			<button
				type="submit"
				class={primaryButtonClass}
				disabled={!newEmail.trim() || changing}
				aria-busy={changing}
			>
				{changing ? m.common_sending() : m.settings_send_link()}
			</button>
		</div>
	</form>
{/if}
