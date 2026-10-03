<script lang="ts">
	import { resolve } from '$app/paths';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import { readApiError } from '$lib/utils/api-error';
	import { toast } from '$lib/utils/toast.svelte';
	import { m } from '$lib/i18n';
	import SettingsSection from './SettingsSection.svelte';
	import { buttonClass, hintClass, rowClass } from './styles';

	interface Props {
		users: Array<{ id: string; name: string; handle: string; image: string | null }>;
	}

	let { users }: Props = $props();

	// Unblocked in this visit; the next load drops them from `users`.
	let unblockedIds = $state<string[]>([]);
	let unblocking = $state<string | null>(null);
	const blockedUsers = $derived(users.filter((u) => !unblockedIds.includes(u.id)));

	async function unblock(id: string, name: string) {
		unblocking = id;
		try {
			const res = await fetch(`/api/users/${encodeURIComponent(id)}/block`, { method: 'DELETE' });
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				toast.error(readApiError(body, m.settings_unblock_error()).message);
				return;
			}
			unblockedIds = [...unblockedIds, id];
			toast.success(m.block_unblocked(name));
		} catch {
			toast.error(m.settings_unblock_error());
		} finally {
			unblocking = null;
		}
	}
</script>

<SettingsSection id="settings-blocked" title={m.settings_blocked_users()}>
	{#each blockedUsers as u (u.id)}
		<div class={rowClass}>
			<a
				href={resolve('/profile/[id]', { id: u.id })}
				class="flex items-center gap-3 min-w-0 no-underline text-inherit"
			>
				<Avatar src={u.image} name={u.name} alt={u.name} size="sm" />
				<span class="flex flex-col min-w-0">
					<span class="truncate">{u.name}</span>
					<span class="{hintClass} truncate">{u.handle}</span>
				</span>
			</a>
			<button
				type="button"
				class={buttonClass}
				onclick={() => unblock(u.id, u.name)}
				disabled={unblocking === u.id}
				aria-busy={unblocking === u.id}
			>
				{unblocking === u.id ? m.block_unblocking() : m.block_unblock()}
			</button>
		</div>
	{:else}
		<p class="{rowClass} m-0 text-sm text-slate-500 dark:text-dark-muted">
			{m.settings_no_blocked()}
		</p>
	{/each}
</SettingsSection>
