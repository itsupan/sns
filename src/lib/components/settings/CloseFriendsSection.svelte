<script lang="ts">
	import { resolve } from '$app/paths';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import { readApiError } from '$lib/utils/api-error';
	import { displayHandle } from '$lib/utils/format';
	import { toast } from '$lib/utils/toast.svelte';
	import { m } from '$lib/i18n';
	import SettingsSection from './SettingsSection.svelte';
	import { buttonClass, fieldClass, hintClass, inputClass, panelClass, rowClass } from './styles';

	interface Listed {
		id: string;
		name: string;
		handle: string;
		image: string | null;
	}

	interface Props {
		users: Listed[];
	}

	let { users }: Props = $props();

	const DEBOUNCE_MS = 150;

	// Changed in this visit; the next load brings the saved list back in `users`.
	let added = $state<Listed[]>([]);
	let removedIds = $state<string[]>([]);
	const friends = $derived(
		[...added, ...users.filter((u) => !added.some((a) => a.id === u.id))].filter(
			(u) => !removedIds.includes(u.id)
		)
	);

	let query = $state('');
	let results = $state<Listed[]>([]);
	const candidates = $derived(results.filter((r) => !friends.some((f) => f.id === r.id)));
	let pending = $state<string | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let latest = 0;

	$effect(() => () => clearTimeout(timer));

	function search() {
		clearTimeout(timer);
		const q = query.trim();
		if (!q) {
			latest += 1;
			results = [];
			return;
		}
		timer = setTimeout(() => load(q), DEBOUNCE_MS);
	}

	async function load(q: string) {
		const request = ++latest;
		try {
			const res = await fetch(`/api/users/suggest?q=${encodeURIComponent(q)}`);
			const body = (await res.json().catch(() => null)) as { users?: Listed[] } | null;
			if (request !== latest) return;
			results = res.ok
				? (body?.users ?? []).map((u) => ({ ...u, handle: displayHandle(u.handle, u.name) }))
				: [];
		} catch {
			if (request === latest) results = [];
		}
	}

	async function change(u: Listed, add: boolean) {
		pending = u.id;
		const fallback = add
			? m.settings_close_friend_add_error()
			: m.settings_close_friend_remove_error();
		try {
			const res = await fetch('/api/account/close-friends', {
				method: add ? 'POST' : 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: u.id })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				toast.error(readApiError(body, fallback).message);
				return;
			}
			if (add) {
				added = [u, ...added.filter((a) => a.id !== u.id)];
				removedIds = removedIds.filter((id) => id !== u.id);
			} else {
				removedIds = [...removedIds, u.id];
			}
		} catch {
			toast.error(fallback);
		} finally {
			pending = null;
		}
	}
</script>

{#snippet person(u: Listed)}
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
{/snippet}

<SettingsSection id="settings-close-friends" title={m.settings_close_friends()}>
	{#each friends as u (u.id)}
		<div class={rowClass}>
			{@render person(u)}
			<button
				type="button"
				class={buttonClass}
				onclick={() => change(u, false)}
				disabled={pending === u.id}
				aria-busy={pending === u.id}
				aria-label={m.settings_close_friend_remove(u.name)}
			>
				{pending === u.id ? m.common_removing() : m.common_remove()}
			</button>
		</div>
	{:else}
		<p class="{rowClass} m-0 text-sm text-slate-500 dark:text-dark-muted">
			{m.settings_no_close_friends()}
		</p>
	{/each}
	<div class={panelClass}>
		<label for="close-friend-search" class={fieldClass}>
			<span>{m.settings_add_close_friends()}</span>
			<span id="close-friend-search-hint" class={hintClass}>
				{m.settings_close_friends_hint()}
			</span>
		</label>
		<input
			id="close-friend-search"
			type="search"
			bind:value={query}
			oninput={search}
			maxlength={31}
			autocomplete="off"
			autocapitalize="off"
			aria-describedby="close-friend-search-hint"
			class={inputClass}
		/>
		{#if candidates.length > 0}
			<ul class="m-0 p-0 list-none flex flex-col" aria-label={m.settings_people_to_add()}>
				{#each candidates as u (u.id)}
					<li class="flex items-center justify-between gap-4 min-h-12 text-[15px]">
						{@render person(u)}
						<button
							type="button"
							class={buttonClass}
							onclick={() => change(u, true)}
							disabled={pending === u.id}
							aria-busy={pending === u.id}
							aria-label={m.settings_close_friend_add(u.name)}
						>
							{pending === u.id ? m.common_adding() : m.common_add()}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</SettingsSection>
