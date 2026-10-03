<script lang="ts">
	import { resolve } from '$app/paths';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import LoadMore from '$lib/components/shared/LoadMore.svelte';
	import { displayHandle } from '$lib/utils/format';
	import { readApiError } from '$lib/utils/api-error';
	import { toast } from '$lib/utils/toast.svelte';
	import type { FollowRequestPage, FollowRequestUser } from '$lib/activity/types';

	let { initial }: { initial: FollowRequestPage } = $props();

	/** Pages loaded after the server-rendered first one. */
	let more = $state<FollowRequestUser[]>([]);
	let moreCursor = $state<string | null | undefined>(undefined);
	// Approved or declined in this visit; the next load leaves them out.
	let handledIds = $state<string[]>([]);
	let busyId = $state<string | null>(null);
	let loadingMore = $state(false);
	let loadError = $state<string | null>(null);

	let requests = $derived.by(() => {
		const seen = new Set(initial.users.map((u) => u.id));
		return [...initial.users, ...more.filter((u) => !seen.has(u.id))].filter(
			(u) => !handledIds.includes(u.id)
		);
	});
	let nextCursor = $derived(moreCursor === undefined ? initial.nextCursor : moreCursor);

	async function respond(person: FollowRequestUser, approve: boolean) {
		busyId = person.id;
		try {
			const res = await fetch(`/api/follow-requests/${encodeURIComponent(person.id)}`, {
				method: approve ? 'POST' : 'DELETE'
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				toast.error(readApiError(body, 'Could not update the request').message);
				return;
			}
			handledIds = [...handledIds, person.id];
			toast.success(approve ? `${person.name} now follows you` : 'Request declined');
		} catch {
			toast.error('Could not update the request');
		} finally {
			busyId = null;
		}
	}

	async function loadMore() {
		if (!nextCursor || loadingMore) return;
		loadingMore = true;
		loadError = null;
		try {
			const res = await fetch(`/api/follow-requests?cursor=${encodeURIComponent(nextCursor)}`);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				loadError = readApiError(body, 'Could not load follow requests').message;
				return;
			}
			const page = body as FollowRequestPage;
			more = [...more, ...page.users];
			moreCursor = page.nextCursor;
		} catch {
			loadError = 'Could not load follow requests';
		} finally {
			loadingMore = false;
		}
	}
</script>

{#if requests.length > 0}
	<section aria-labelledby="follow-requests-title" class="flex flex-col gap-2">
		<h2
			id="follow-requests-title"
			class="text-sm font-semibold text-slate-900 dark:text-dark-text m-0"
		>
			Follow requests
		</h2>
		<ul
			class="list-none m-0 p-0 rounded-3xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card divide-y divide-slate-100 dark:divide-dark-border overflow-hidden"
		>
			{#each requests as person (person.id)}
				{@const busy = busyId === person.id}
				<li data-testid="follow-request" class="flex items-center gap-3 px-4 py-3">
					<a
						href={resolve('/profile/[id]', { id: person.handle?.replace(/^@/, '') || person.id })}
						class="flex items-center gap-3 min-w-0 flex-1 no-underline text-inherit"
					>
						<Avatar src={person.image ?? ''} name={person.name} size="md" />
						<span class="flex flex-col min-w-0 leading-tight">
							<span class="text-sm font-semibold text-slate-950 dark:text-white truncate"
								>{person.name}</span
							>
							<span class="text-xs text-slate-500 dark:text-dark-muted truncate"
								>{displayHandle(person.handle, person.name)}</span
							>
						</span>
					</a>
					<button
						type="button"
						class="shrink-0 h-8 px-4 rounded-full text-xs font-semibold border-0 cursor-pointer bg-blue-600 dark:bg-kizuna-blue text-white disabled:opacity-50"
						disabled={busy}
						aria-label="Approve {person.name}"
						onclick={() => respond(person, true)}>Approve</button
					>
					<button
						type="button"
						class="shrink-0 h-8 px-4 rounded-full text-xs font-semibold border-0 cursor-pointer bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text disabled:opacity-50"
						disabled={busy}
						aria-label="Decline {person.name}"
						onclick={() => respond(person, false)}>Decline</button
					>
				</li>
			{/each}
		</ul>
		{#if nextCursor}
			<LoadMore onLoad={loadMore} loading={loadingMore} error={loadError} />
		{/if}
	</section>
{/if}
