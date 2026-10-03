<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import { LEGAL_LINKS } from '$lib/constants/legal';
	import Icon from '$lib/components/shared/Icon.svelte';
	import ThemeToggle from '$lib/components/shared/ThemeToggle.svelte';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import { readApiError } from '$lib/utils/api-error';
	import { toast } from '$lib/utils/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let signingOut = $state(false);
	let exporting = $state(false);

	async function downloadData() {
		exporting = true;
		try {
			const res = await fetch('/api/account/export');
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				toast.error(readApiError(body, 'Could not prepare your data').message);
				return;
			}
			const name =
				/filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ??
				'kizuna-data.json';
			const href = URL.createObjectURL(await res.blob());
			const a = document.createElement('a');
			a.href = href;
			a.download = name;
			a.click();
			URL.revokeObjectURL(href);
			toast.success('Your data is downloading');
		} catch {
			toast.error('Could not prepare your data');
		} finally {
			exporting = false;
		}
	}

	// Unblocked in this visit; the next load drops them from `data.blockedUsers`.
	let unblockedIds = $state<string[]>([]);
	let unblocking = $state<string | null>(null);
	const blockedUsers = $derived(data.blockedUsers.filter((u) => !unblockedIds.includes(u.id)));

	async function unblock(id: string, name: string) {
		unblocking = id;
		try {
			const res = await fetch(`/api/users/${encodeURIComponent(id)}/block`, { method: 'DELETE' });
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				toast.error(readApiError(body, 'Could not unblock').message);
				return;
			}
			unblockedIds = [...unblockedIds, id];
			toast.success(`Unblocked ${name}`);
		} catch {
			toast.error('Could not unblock');
		} finally {
			unblocking = null;
		}
	}

	let deleteOpen = $state(false);
	let deleteConfirm = $state('');
	let deletePassword = $state('');
	let deleteError = $state('');
	let deleting = $state(false);
	const canDelete = $derived(
		deleteConfirm === 'DELETE' && (!data.hasPassword || deletePassword.length > 0) && !deleting
	);

	function closeDelete() {
		deleteOpen = false;
		deleteConfirm = '';
		deletePassword = '';
		deleteError = '';
	}

	async function deleteAccount(event: SubmitEvent) {
		event.preventDefault();
		if (!canDelete) return;
		deleting = true;
		deleteError = '';
		try {
			const res = await fetch('/api/account', {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					confirm: deleteConfirm,
					...(data.hasPassword ? { password: deletePassword } : {})
				})
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				deleteError = readApiError(body, 'Could not delete your account').message;
				return;
			}
			toast.success('Your account has been deleted');
			// Sessions were deleted with the account; a full load drops any cached signed-in state.
			await goto(resolve('/'), { invalidateAll: true });
		} catch {
			deleteError = 'Could not delete your account';
		} finally {
			deleting = false;
		}
	}

	async function signOut() {
		signingOut = true;
		await authClient.signOut();
		await goto(resolve('/login'));
	}

	const rowClass =
		'flex items-center justify-between gap-4 min-h-12 px-4 py-2 text-[15px] text-slate-900 dark:text-dark-text no-underline';
	const cardClass =
		'bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border rounded-2xl divide-y divide-slate-100 dark:divide-dark-border overflow-hidden';
	const headingClass =
		'px-1 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-dark-subtle';
</script>

<svelte:head><title>Settings · Kizuna</title></svelte:head>

<main class="w-full max-w-2xl mx-auto px-4 py-6 sm:py-10 flex flex-col gap-6">
	<h1 class="text-2xl font-bold m-0">Settings</h1>

	<section aria-labelledby="settings-account">
		<h2 id="settings-account" class={headingClass}>Account</h2>
		<div class={cardClass}>
			<div class={rowClass}>
				<span>Email</span>
				<span class="text-sm text-slate-500 dark:text-dark-muted truncate min-w-0"
					>{data.email}</span
				>
			</div>
			<a
				href={resolve('/profile/edit')}
				class="{rowClass} hover:bg-slate-50 dark:hover:bg-dark-hover"
			>
				<span>Edit profile</span>
				<Icon name="angle-right" class="text-slate-400" />
			</a>
			<div class={rowClass}>
				<span>Appearance</span>
				<ThemeToggle variant="segmented" />
			</div>
		</div>
	</section>

	<section aria-labelledby="settings-data">
		<h2 id="settings-data" class={headingClass}>Privacy & data</h2>
		<div class={cardClass}>
			<div class={rowClass}>
				<div class="flex flex-col min-w-0">
					<span>Download your data</span>
					<span class="text-xs text-slate-500 dark:text-dark-muted"
						>Profile, posts, comments, follows and messages as a JSON file</span
					>
				</div>
				<button
					type="button"
					class="shrink-0 h-9 px-4 rounded-full text-xs font-semibold bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text hover:bg-slate-200 dark:hover:bg-dark-hover border-0 cursor-pointer disabled:opacity-60"
					onclick={downloadData}
					disabled={exporting}
					aria-busy={exporting}
				>
					{exporting ? 'Preparing…' : 'Download'}
				</button>
			</div>
			<div class={rowClass}>
				<div class="flex flex-col min-w-0">
					<span class="text-red-600 dark:text-red-400">Delete account</span>
					<span class="text-xs text-slate-500 dark:text-dark-muted"
						>Permanently removes your profile, posts, comments, follows and messages</span
					>
				</div>
				<button
					type="button"
					class="shrink-0 h-9 px-4 rounded-full text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/60 border-0 cursor-pointer"
					onclick={() => (deleteOpen ? closeDelete() : (deleteOpen = true))}
					aria-expanded={deleteOpen}
					aria-controls="delete-account-panel"
				>
					Delete
				</button>
			</div>
			{#if deleteOpen}
				<form
					id="delete-account-panel"
					class="flex flex-col gap-3 px-4 py-4 bg-red-50/50 dark:bg-red-950/20"
					onsubmit={deleteAccount}
				>
					<p class="m-0 text-sm text-slate-700 dark:text-dark-muted">
						This cannot be undone. Everything you have posted and your messages will be deleted for
						good. Download your data first if you want a copy.
					</p>
					<label class="flex flex-col gap-1 text-sm">
						<span>Type <strong>DELETE</strong> to confirm</span>
						<input
							type="text"
							bind:value={deleteConfirm}
							autocomplete="off"
							autocapitalize="characters"
							spellcheck="false"
							class="h-10 px-3 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text"
						/>
					</label>
					{#if data.hasPassword}
						<label class="flex flex-col gap-1 text-sm">
							<span>Password</span>
							<input
								type="password"
								bind:value={deletePassword}
								autocomplete="current-password"
								class="h-10 px-3 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text"
							/>
						</label>
					{/if}
					{#if deleteError}
						<p class="m-0 text-sm text-red-600 dark:text-red-400" role="alert">{deleteError}</p>
					{/if}
					<div class="flex justify-end gap-2">
						<button
							type="button"
							class="h-9 px-4 rounded-full text-xs font-semibold bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text hover:bg-slate-200 dark:hover:bg-dark-hover border-0 cursor-pointer"
							onclick={closeDelete}
						>
							Cancel
						</button>
						<button
							type="submit"
							class="h-9 px-4 rounded-full text-xs font-semibold text-white bg-red-600 hover:bg-red-700 border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
							disabled={!canDelete}
							aria-busy={deleting}
						>
							{deleting ? 'Deleting…' : 'Delete my account'}
						</button>
					</div>
				</form>
			{/if}
		</div>
	</section>

	<section aria-labelledby="settings-blocked">
		<h2 id="settings-blocked" class={headingClass}>Blocked users</h2>
		<div class={cardClass}>
			{#each blockedUsers as u (u.id)}
				<div class={rowClass}>
					<a
						href={resolve('/profile/[id]', { id: u.id })}
						class="flex items-center gap-3 min-w-0 no-underline text-inherit"
					>
						<Avatar src={u.image} name={u.name} alt={u.name} size="sm" />
						<span class="flex flex-col min-w-0">
							<span class="truncate">{u.name}</span>
							<span class="text-xs text-slate-500 dark:text-dark-muted truncate">{u.handle}</span>
						</span>
					</a>
					<button
						type="button"
						class="shrink-0 h-9 px-4 rounded-full text-xs font-semibold bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text hover:bg-slate-200 dark:hover:bg-dark-hover border-0 cursor-pointer disabled:opacity-60"
						onclick={() => unblock(u.id, u.name)}
						disabled={unblocking === u.id}
						aria-busy={unblocking === u.id}
					>
						{unblocking === u.id ? 'Unblocking…' : 'Unblock'}
					</button>
				</div>
			{:else}
				<p class="{rowClass} m-0 text-sm text-slate-500 dark:text-dark-muted">
					You haven't blocked anyone.
				</p>
			{/each}
		</div>
	</section>

	<section aria-labelledby="settings-legal">
		<h2 id="settings-legal" class={headingClass}>About & legal</h2>
		<div class={cardClass}>
			{#each LEGAL_LINKS as link (link.href)}
				<a href={resolve(link.href)} class="{rowClass} hover:bg-slate-50 dark:hover:bg-dark-hover">
					<span>{link.title}</span>
					<Icon name="angle-right" class="text-slate-400" />
				</a>
			{/each}
		</div>
	</section>

	<button
		type="button"
		class="self-start inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/60 border-0 cursor-pointer disabled:opacity-60"
		onclick={signOut}
		disabled={signingOut}
	>
		<Icon name="sign-out-alt" />
		Log out
	</button>
</main>
