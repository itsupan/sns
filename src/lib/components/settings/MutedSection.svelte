<script lang="ts">
	import { resolve } from '$app/paths';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { MAX_MUTED_KEYWORD_LENGTH, MAX_MUTED_KEYWORDS } from '$lib/constants/mute-limits';
	import { readApiError } from '$lib/utils/api-error';
	import { muteStore } from '$lib/utils/mute.svelte';
	import { toast } from '$lib/utils/toast.svelte';
	import SettingsSection from './SettingsSection.svelte';
	import {
		buttonClass,
		fieldClass,
		hintClass,
		inputClass,
		panelClass,
		primaryButtonClass,
		rowClass
	} from './styles';

	interface Props {
		users: Array<{ id: string; name: string; handle: string; image: string | null }>;
		keywords: string[];
	}

	let { users, keywords }: Props = $props();

	// Unmuting goes through the shared store, so post cards in this tab follow; the next load
	// drops them from `users`.
	const mutedUsers = $derived(users.filter((u) => muteStore.muted(u.id, true)));

	async function unmute(id: string, name: string) {
		try {
			await muteStore.set(id, false);
			toast.success(`Unmuted ${name}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not unmute');
		}
	}

	// Changed in this visit; the next load brings the saved list back in `keywords`.
	let added = $state<string[]>([]);
	let removed = $state<string[]>([]);
	const mutedKeywords = $derived(
		[...added, ...keywords.filter((k) => !added.includes(k))].filter((k) => !removed.includes(k))
	);
	const full = $derived(mutedKeywords.length >= MAX_MUTED_KEYWORDS);

	let draft = $state('');
	let adding = $state(false);
	let removing = $state<string | null>(null);

	async function addKeyword(event: SubmitEvent) {
		event.preventDefault();
		// The server stores keywords the same way, trimmed and lowercased.
		const keyword = draft.trim().toLowerCase();
		if (!keyword || adding) return;
		adding = true;
		try {
			const res = await fetch('/api/account/muted-keywords', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ keyword })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				toast.error(readApiError(body, 'Could not mute that word').message);
				return;
			}
			added = [keyword, ...added.filter((k) => k !== keyword)];
			removed = removed.filter((k) => k !== keyword);
			draft = '';
		} catch {
			toast.error('Could not mute that word');
		} finally {
			adding = false;
		}
	}

	async function removeKeyword(keyword: string) {
		removing = keyword;
		try {
			const res = await fetch('/api/account/muted-keywords', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ keyword })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				toast.error(readApiError(body, 'Could not unmute that word').message);
				return;
			}
			removed = [...removed, keyword];
		} catch {
			toast.error('Could not unmute that word');
		} finally {
			removing = null;
		}
	}
</script>

<SettingsSection id="settings-muted" title="Muted">
	{#each mutedUsers as u (u.id)}
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
				onclick={() => unmute(u.id, u.name)}
				disabled={muteStore.isPending(u.id)}
				aria-busy={muteStore.isPending(u.id)}
			>
				{muteStore.isPending(u.id) ? 'Unmuting…' : 'Unmute'}
			</button>
		</div>
	{:else}
		<p class="{rowClass} m-0 text-sm text-slate-500 dark:text-dark-muted">
			You haven't muted anyone.
		</p>
	{/each}
	<form class={panelClass} onsubmit={addKeyword}>
		<label for="muted-keyword" class={fieldClass}>
			<span>Muted words</span>
			<span id="muted-keyword-hint" class={hintClass}>
				Posts containing a muted word or phrase stay out of your feed, Explore and tag pages. Up to {MAX_MUTED_KEYWORDS}.
			</span>
		</label>
		<div class="flex gap-2">
			<input
				id="muted-keyword"
				bind:value={draft}
				maxlength={MAX_MUTED_KEYWORD_LENGTH}
				autocomplete="off"
				autocapitalize="off"
				aria-describedby="muted-keyword-hint"
				disabled={full}
				class="{inputClass} flex-1 min-w-0"
			/>
			<button
				type="submit"
				class={primaryButtonClass}
				disabled={!draft.trim() || adding || full}
				aria-busy={adding}
			>
				{adding ? 'Muting…' : 'Mute'}
			</button>
		</div>
		{#if mutedKeywords.length > 0}
			<ul class="m-0 p-0 list-none flex flex-wrap gap-2" aria-label="Muted words">
				{#each mutedKeywords as keyword (keyword)}
					<li
						class="inline-flex items-center gap-1 h-8 pl-3 pr-1 rounded-full bg-slate-100 dark:bg-dark-elevated text-sm text-slate-900 dark:text-dark-text"
					>
						<span>{keyword}</span>
						<button
							type="button"
							class="size-6 rounded-full flex items-center justify-center border-0 bg-transparent cursor-pointer text-slate-500 dark:text-dark-muted hover:bg-slate-200 dark:hover:bg-dark-hover disabled:opacity-60"
							onclick={() => removeKeyword(keyword)}
							disabled={removing === keyword}
							aria-label={`Unmute "${keyword}"`}
						>
							<Icon name="cross" class="text-xs" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</form>
</SettingsSection>
