<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { locale, m } from '$lib/i18n';
	import { readApiError } from '$lib/utils/api-error';
	import { toast } from '$lib/utils/toast.svelte';
	import { buttonClass, hintClass, rowClass } from './styles';

	interface Props {
		sessions: Array<{
			id: string;
			device: string;
			createdAt: Date;
			lastActiveAt: Date;
			/** The session this page was loaded with. */
			current: boolean;
		}>;
	}

	let { sessions }: Props = $props();

	const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

	// Signed out in this visit; the next load drops them from `sessions`.
	let revokedIds = $state<string[]>([]);
	/** The session being signed out, or `others` while signing out all but this one. */
	let busy = $state<string | null>(null);
	const active = $derived(sessions.filter((s) => !revokedIds.includes(s.id)));
	const others = $derived(active.filter((s) => !s.current));

	async function revoke(id: string) {
		busy = id;
		try {
			const res = await fetch(`/api/account/sessions/${encodeURIComponent(id)}`, {
				method: 'DELETE'
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				toast.error(readApiError(body, m.settings_session_error()).message);
				return;
			}
			revokedIds = [...revokedIds, id];
			toast.success(m.settings_session_signed_out());
		} catch {
			toast.error(m.settings_session_error());
		} finally {
			busy = null;
		}
	}

	async function revokeOthers() {
		busy = 'others';
		try {
			const { error } = await authClient.revokeOtherSessions();
			if (error) {
				toast.error(error.message || m.settings_sessions_error());
				return;
			}
			revokedIds = [...revokedIds, ...others.map((s) => s.id)];
			toast.success(m.settings_sessions_signed_out());
		} catch {
			toast.error(m.settings_sessions_error());
		} finally {
			busy = null;
		}
	}
</script>

<div class={rowClass}>
	<h3 class="m-0 text-[15px] font-normal">{m.settings_active_sessions()}</h3>
	{#if others.length > 0}
		<button
			type="button"
			class={buttonClass}
			onclick={revokeOthers}
			disabled={busy !== null}
			aria-busy={busy === 'others'}
		>
			{busy === 'others' ? m.settings_signing_out() : m.settings_sign_out_others()}
		</button>
	{/if}
</div>
<ul class="m-0 p-0 list-none divide-y divide-slate-100 dark:divide-dark-border">
	{#each active as s (s.id)}
		<li class={rowClass}>
			<div class="flex flex-col min-w-0">
				<span class="flex items-center gap-2 min-w-0">
					<span class="truncate">{s.device}</span>
					{#if s.current}
						<span
							class="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
							>{m.settings_this_device()}</span
						>
					{/if}
				</span>
				<span class={hintClass}>
					{m.settings_session_signed_in(dateFormat.format(s.createdAt))}{#if !s.current}
						{m.settings_session_last_active(dateFormat.format(s.lastActiveAt))}{/if}
				</span>
			</div>
			{#if !s.current}
				<button
					type="button"
					class={buttonClass}
					onclick={() => revoke(s.id)}
					disabled={busy !== null}
					aria-busy={busy === s.id}
					aria-label={m.settings_sign_out_device(s.device)}
				>
					{busy === s.id ? m.settings_signing_out() : m.settings_sign_out()}
				</button>
			{/if}
		</li>
	{/each}
</ul>
