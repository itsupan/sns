<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Icon from '$lib/components/shared/Icon.svelte';
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';
	import { toast } from '$lib/utils/toast.svelte';
	import { readApiError } from '$lib/utils/api-error';
	import { followStore } from '$lib/utils/follow.svelte';

	interface Props {
		userId: string;
		name: string;
		/** Whether the viewer has blocked this user. */
		blocked: boolean;
	}

	let { userId, name, blocked }: Props = $props();

	let confirmOpen = $state(false);
	let saving = $state(false);

	/** Blocks (POST) or unblocks (DELETE), then reloads the page data for the new state. */
	async function apply() {
		const block = !blocked;
		saving = true;
		try {
			const res = await fetch(`/api/users/${encodeURIComponent(userId)}/block`, {
				method: block ? 'POST' : 'DELETE'
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(readApiError(body, 'Could not update block').message);
			}
			// Blocking removed any follow between us on the server.
			if (block) followStore.forget(userId);
			confirmOpen = false;
			toast.show(block ? `Blocked ${name}` : `Unblocked ${name}`);
			await invalidateAll();
		} catch (err) {
			toast.show(err instanceof Error ? err.message : 'Could not update block');
		} finally {
			saving = false;
		}
	}
</script>

<button
	type="button"
	class="h-11 sm:h-10 px-4 rounded-full bg-slate-100 dark:bg-dark-elevated sm:bg-white sm:dark:bg-dark-elevated sm:border sm:border-slate-200 sm:dark:border-dark-border text-red-600 dark:text-red-400 hover:bg-slate-200 dark:hover:bg-dark-hover flex items-center justify-center gap-1.5 font-semibold text-xs transition-colors duration-150 cursor-pointer border-0 shrink-0 shadow-xs"
	onclick={() => (confirmOpen = true)}
>
	<Icon name="ban" class="text-sm" />
	<span>{blocked ? 'Unblock' : 'Block'}</span>
</button>

<BottomSheet
	bind:open={confirmOpen}
	title={blocked ? `Unblock ${name}?` : `Block ${name}?`}
	showTitle
>
	<p class="px-3 pb-2 text-sm text-slate-600 dark:text-dark-muted">
		{blocked
			? 'They will be able to see your posts, follow you and message you again.'
			: "You won't see each other's posts or comments, and they can't follow or message you. Any follows between you are removed. They aren't told."}
	</p>
	{#snippet footer()}
		<div class="flex justify-end gap-2">
			<button
				type="button"
				class="h-10 px-4 rounded-full text-sm font-semibold bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text border-0 cursor-pointer hover:bg-slate-200 dark:hover:bg-dark-hover"
				onclick={() => (confirmOpen = false)}
			>
				Cancel
			</button>
			<button
				type="button"
				class="h-10 px-5 rounded-full text-sm font-semibold border-0 cursor-pointer disabled:opacity-50 disabled:cursor-default {blocked
					? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
					: 'bg-red-600 text-white hover:bg-red-700'}"
				disabled={saving}
				aria-busy={saving}
				onclick={apply}
			>
				{#if saving}
					{blocked ? 'Unblocking…' : 'Blocking…'}
				{:else}
					{blocked ? 'Unblock' : 'Block'}
				{/if}
			</button>
		</div>
	{/snippet}
</BottomSheet>
