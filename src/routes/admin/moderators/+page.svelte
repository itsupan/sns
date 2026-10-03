<script lang="ts">
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import LoadMore from '$lib/components/shared/LoadMore.svelte';
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
	import {
		buttonClass,
		dangerButtonClass,
		errorClass,
		fieldClass,
		inputClass,
		panelClass,
		primaryButtonClass,
		rowClass
	} from '$lib/components/settings/styles';
	import { readApiError } from '$lib/utils/api-error';
	import { displayHandle } from '$lib/utils/format';
	import { toast } from '$lib/utils/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Staff = (typeof data.users)[number];

	/** Granted here, loaded while scrolling, or revoked, on top of the server-rendered first page. */
	let granted = $state<Staff[]>([]);
	let more = $state<Staff[]>([]);
	let revoked = $state<string[]>([]);
	let moreCursor = $state<string | null | undefined>(undefined);
	let loadingMore = $state(false);
	let loadError = $state<string | null>(null);

	let staff = $derived.by(() => {
		const seen = new Set(revoked);
		return [...granted, ...data.users, ...more].filter((u) => {
			if (seen.has(u.id)) return false;
			seen.add(u.id);
			return true;
		});
	});
	let nextCursor = $derived(moreCursor === undefined ? data.nextCursor : moreCursor);

	let grantInput = $state('');
	let grantError = $state<string | null>(null);
	let granting = $state(false);

	let liftInput = $state('');
	let liftError = $state<string | null>(null);
	let lifting = $state(false);

	let revoking = $state<Staff | null>(null);
	let revokeOpen = $state(false);
	let revokeBusy = $state(false);

	async function grant() {
		const user = grantInput.trim();
		if (!user || granting) return;
		granting = true;
		grantError = null;
		try {
			const res = await fetch('/api/admin/moderators', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user })
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				grantError = readApiError(body, 'Could not add the moderator').message;
				return;
			}
			const added = (body as { user: Staff }).user;
			granted = [added, ...granted];
			revoked = revoked.filter((id) => id !== added.id);
			grantInput = '';
			toast.success(`${added.name} is now a moderator`);
		} catch {
			grantError = 'Could not add the moderator';
		} finally {
			granting = false;
		}
	}

	async function revoke() {
		if (!revoking || revokeBusy) return;
		const target = revoking;
		revokeBusy = true;
		try {
			const res = await fetch(`/api/admin/moderators/${encodeURIComponent(target.id)}`, {
				method: 'DELETE'
			});
			if (!res.ok) {
				toast.error(readApiError(await res.json().catch(() => null), 'Could not revoke').message);
				return;
			}
			revoked = [...revoked, target.id];
			granted = granted.filter((u) => u.id !== target.id);
			revokeOpen = false;
			toast.success(`${target.name} is no longer a moderator`);
		} catch {
			toast.error('Could not revoke');
		} finally {
			revokeBusy = false;
		}
	}

	async function lift() {
		const user = liftInput.trim().replace(/^@/, '');
		if (!user || lifting) return;
		lifting = true;
		liftError = null;
		try {
			const res = await fetch(`/api/admin/users/${encodeURIComponent(user)}/suspension`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: '{}'
			});
			if (!res.ok) {
				liftError = readApiError(await res.json().catch(() => null), 'Could not lift').message;
				return;
			}
			liftInput = '';
			toast.success('Suspension lifted');
		} catch {
			liftError = 'Could not lift the suspension';
		} finally {
			lifting = false;
		}
	}

	async function loadMore() {
		if (!nextCursor || loadingMore) return;
		loadingMore = true;
		loadError = null;
		try {
			const res = await fetch(`/api/admin/moderators?cursor=${encodeURIComponent(nextCursor)}`);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				loadError = readApiError(body, 'Could not load moderators').message;
				return;
			}
			const page = body as { users: Staff[]; nextCursor: string | null };
			more = [...more, ...page.users];
			moreCursor = page.nextCursor;
		} catch {
			loadError = 'Could not load moderators';
		} finally {
			loadingMore = false;
		}
	}
</script>

<svelte:head><title>Moderators · Kizuna</title></svelte:head>

<SettingsSection id="admin-staff" title="Moderators and admins">
	{#each staff as member (member.id)}
		<div class={rowClass}>
			<div class="flex items-center gap-3 min-w-0">
				<Avatar src={member.image} name={member.name} size="sm" />
				<div class="flex flex-col min-w-0">
					<span class="truncate font-medium">{member.name}</span>
					<span class="text-xs text-slate-500 dark:text-dark-muted">
						{displayHandle(member.handle, member.name)} · {member.role}
					</span>
				</div>
			</div>
			{#if member.role === 'moderator'}
				<button
					type="button"
					class={dangerButtonClass}
					onclick={() => {
						revoking = member;
						revokeOpen = true;
					}}
				>
					Revoke
				</button>
			{/if}
		</div>
	{/each}
</SettingsSection>
{#if nextCursor}
	<LoadMore onLoad={loadMore} loading={loadingMore} error={loadError} />
{/if}

<SettingsSection id="admin-grant" title="Add a moderator">
	<form
		class={panelClass}
		onsubmit={(e) => {
			e.preventDefault();
			grant();
		}}
	>
		<label class={fieldClass}>
			<span>Handle or user id</span>
			<input class={inputClass} bind:value={grantInput} autocomplete="off" placeholder="@handle" />
		</label>
		{#if grantError}<p role="alert" class={errorClass}>{grantError}</p>{/if}
		<button
			type="submit"
			class="{primaryButtonClass} self-end"
			disabled={!grantInput.trim() || granting}
		>
			{granting ? 'Adding…' : 'Make moderator'}
		</button>
	</form>
</SettingsSection>

<SettingsSection id="admin-lift" title="Lift a suspension">
	<form
		class={panelClass}
		onsubmit={(e) => {
			e.preventDefault();
			lift();
		}}
	>
		<label class={fieldClass}>
			<span>Handle or user id</span>
			<input class={inputClass} bind:value={liftInput} autocomplete="off" placeholder="@handle" />
		</label>
		{#if liftError}<p role="alert" class={errorClass}>{liftError}</p>{/if}
		<button type="submit" class="{buttonClass} self-end" disabled={!liftInput.trim() || lifting}>
			{lifting ? 'Lifting…' : 'Lift suspension'}
		</button>
	</form>
</SettingsSection>

<BottomSheet bind:open={revokeOpen} title="Revoke moderator" showTitle>
	<p class="m-0 px-2 text-sm text-slate-600 dark:text-dark-muted">
		{revoking?.name} will lose access to the moderation queue right away.
	</p>
	{#snippet footer()}
		<div class="flex justify-end gap-2">
			<button type="button" class={buttonClass} onclick={() => (revokeOpen = false)}>Cancel</button>
			<button type="button" class={dangerButtonClass} disabled={revokeBusy} onclick={revoke}>
				{revokeBusy ? 'Revoking…' : 'Revoke'}
			</button>
		</div>
	{/snippet}
</BottomSheet>
