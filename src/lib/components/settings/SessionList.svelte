<script lang="ts">
	import { authClient } from '$lib/auth-client';
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

	const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

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
				toast.error(readApiError(body, 'Could not sign out that session').message);
				return;
			}
			revokedIds = [...revokedIds, id];
			toast.success('Signed out of that session');
		} catch {
			toast.error('Could not sign out that session');
		} finally {
			busy = null;
		}
	}

	async function revokeOthers() {
		busy = 'others';
		try {
			const { error } = await authClient.revokeOtherSessions();
			if (error) {
				toast.error(error.message || 'Could not sign out your other sessions');
				return;
			}
			revokedIds = [...revokedIds, ...others.map((s) => s.id)];
			toast.success('Signed out of all other sessions');
		} catch {
			toast.error('Could not sign out your other sessions');
		} finally {
			busy = null;
		}
	}
</script>

<div class={rowClass}>
	<h3 class="m-0 text-[15px] font-normal">Active sessions</h3>
	{#if others.length > 0}
		<button
			type="button"
			class={buttonClass}
			onclick={revokeOthers}
			disabled={busy !== null}
			aria-busy={busy === 'others'}
		>
			{busy === 'others' ? 'Signing out…' : 'Sign out of other sessions'}
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
							>This device</span
						>
					{/if}
				</span>
				<span class={hintClass}>
					Signed in {dateFormat.format(s.createdAt)}{#if !s.current}
						· Last active {dateFormat.format(s.lastActiveAt)}{/if}
				</span>
			</div>
			{#if !s.current}
				<button
					type="button"
					class={buttonClass}
					onclick={() => revoke(s.id)}
					disabled={busy !== null}
					aria-busy={busy === s.id}
					aria-label="Sign out {s.device}"
				>
					{busy === s.id ? 'Signing out…' : 'Sign out'}
				</button>
			{/if}
		</li>
	{/each}
</ul>
