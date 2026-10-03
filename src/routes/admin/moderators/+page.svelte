<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
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
	import { m } from '$lib/i18n';
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
		const seen = new SvelteSet(revoked);
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
				grantError = readApiError(body, m.moderation_add_error()).message;
				return;
			}
			const added = (body as { user: Staff }).user;
			granted = [added, ...granted];
			revoked = revoked.filter((id) => id !== added.id);
			grantInput = '';
			toast.success(m.moderation_now_moderator(added.name));
		} catch {
			grantError = m.moderation_add_error();
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
				toast.error(
					readApiError(await res.json().catch(() => null), m.moderation_revoke_error()).message
				);
				return;
			}
			revoked = [...revoked, target.id];
			granted = granted.filter((u) => u.id !== target.id);
			revokeOpen = false;
			toast.success(m.moderation_no_longer_moderator(target.name));
		} catch {
			toast.error(m.moderation_revoke_error());
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
				liftError = readApiError(
					await res.json().catch(() => null),
					m.moderation_lift_error()
				).message;
				return;
			}
			liftInput = '';
			toast.success(m.moderation_lifted());
		} catch {
			liftError = m.moderation_lift_suspension_error();
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
				loadError = readApiError(body, m.moderation_moderators_load_error()).message;
				return;
			}
			const page = body as { users: Staff[]; nextCursor: string | null };
			more = [...more, ...page.users];
			moreCursor = page.nextCursor;
		} catch {
			loadError = m.moderation_moderators_load_error();
		} finally {
			loadingMore = false;
		}
	}
</script>

<svelte:head><title>{m.moderation_moderators_title()}</title></svelte:head>

<SettingsSection id="admin-staff" title={m.moderation_staff()}>
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
					{m.moderation_revoke()}
				</button>
			{/if}
		</div>
	{/each}
</SettingsSection>
{#if nextCursor}
	<LoadMore onLoad={loadMore} loading={loadingMore} error={loadError} />
{/if}

<SettingsSection id="admin-grant" title={m.moderation_add()}>
	<form
		class={panelClass}
		onsubmit={(e) => {
			e.preventDefault();
			grant();
		}}
	>
		<label class={fieldClass}>
			<span>{m.moderation_user_field()}</span>
			<input
				class={inputClass}
				bind:value={grantInput}
				autocomplete="off"
				placeholder={m.moderation_user_placeholder()}
			/>
		</label>
		{#if grantError}<p role="alert" class={errorClass}>{grantError}</p>{/if}
		<button
			type="submit"
			class="{primaryButtonClass} self-end"
			disabled={!grantInput.trim() || granting}
		>
			{granting ? m.common_adding() : m.moderation_make_moderator()}
		</button>
	</form>
</SettingsSection>

<SettingsSection id="admin-lift" title={m.moderation_lift_title()}>
	<form
		class={panelClass}
		onsubmit={(e) => {
			e.preventDefault();
			lift();
		}}
	>
		<label class={fieldClass}>
			<span>{m.moderation_user_field()}</span>
			<input
				class={inputClass}
				bind:value={liftInput}
				autocomplete="off"
				placeholder={m.moderation_user_placeholder()}
			/>
		</label>
		{#if liftError}<p role="alert" class={errorClass}>{liftError}</p>{/if}
		<button type="submit" class="{buttonClass} self-end" disabled={!liftInput.trim() || lifting}>
			{lifting ? m.moderation_lifting() : m.moderation_lift()}
		</button>
	</form>
</SettingsSection>

<BottomSheet bind:open={revokeOpen} title={m.moderation_revoke_title()} showTitle>
	<p class="m-0 px-2 text-sm text-slate-600 dark:text-dark-muted">
		{m.moderation_revoke_hint(revoking?.name ?? '')}
	</p>
	{#snippet footer()}
		<div class="flex justify-end gap-2">
			<button type="button" class={buttonClass} onclick={() => (revokeOpen = false)}
				>{m.common_cancel()}</button
			>
			<button type="button" class={dangerButtonClass} disabled={revokeBusy} onclick={revoke}>
				{revokeBusy ? m.moderation_revoking() : m.moderation_revoke()}
			</button>
		</div>
	{/snippet}
</BottomSheet>
