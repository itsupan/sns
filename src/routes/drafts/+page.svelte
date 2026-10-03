<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { POST_TYPES } from '$lib/components/feed/post-draft.svelte';
	import { MAX_DRAFTS_PER_USER, formatPublishAt, type DraftData } from '$lib/drafts';
	import { formatTimeAgo } from '$lib/utils/format';
	import { readApiError } from '$lib/utils/api-error';
	import { toast } from '$lib/utils/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** The draft an action is running on; one at a time. */
	let busyId = $state<string | null>(null);
	let pendingDelete = $state<DraftData | null>(null);
	let confirmOpen = $state(false);

	function typeOf(draft: DraftData) {
		return POST_TYPES.find((t) => t.id === draft.payload.postType) ?? POST_TYPES[0];
	}

	/** Runs `request` on a draft, then reloads the list: either way the draft may have changed. */
	async function act(draft: DraftData, request: () => Promise<Response>, done: string) {
		if (busyId) return;
		busyId = draft.id;
		try {
			const res = await request();
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				toast.show(readApiError(body, 'Something went wrong').message);
				return;
			}
			toast.show(done);
		} catch {
			toast.show('Something went wrong');
		} finally {
			await invalidateAll();
			busyId = null;
		}
	}

	function publishNow(draft: DraftData) {
		return act(
			draft,
			() => fetch(`/api/drafts/${draft.id}/publish`, { method: 'POST' }),
			'Post published'
		);
	}

	function confirmDelete(draft: DraftData) {
		pendingDelete = draft;
		confirmOpen = true;
	}

	async function deletePending() {
		if (!pendingDelete) return;
		const draft = pendingDelete;
		await act(draft, () => fetch(`/api/drafts/${draft.id}`, { method: 'DELETE' }), 'Draft deleted');
		confirmOpen = false;
	}
</script>

<svelte:head>
	<title>Drafts · Kizuna</title>
</svelte:head>

<main class="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
	<div class="flex items-end justify-between gap-3">
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-950 dark:text-white m-0">Drafts</h1>
			<p class="text-xs text-slate-500 dark:text-dark-muted m-0 mt-1">
				Only you can see your drafts. Scheduled ones publish on their own.
			</p>
		</div>
		<span class="text-[11px] font-mono text-slate-400 dark:text-dark-subtle shrink-0">
			{data.drafts.length} / {MAX_DRAFTS_PER_USER}
		</span>
	</div>

	{#if data.drafts.length === 0}
		<div
			class="rounded-3xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card py-16 px-6 flex flex-col items-center gap-2 text-center"
		>
			<Icon name="document" class="text-3xl text-slate-300" />
			<p class="text-sm font-semibold text-slate-900 dark:text-dark-text m-0">No drafts yet</p>
			<p class="text-xs text-slate-500 dark:text-dark-muted m-0">
				Use "Save draft" or "Schedule" in the composer to keep a post for later.
			</p>
		</div>
	{:else}
		<ul class="list-none m-0 p-0 flex flex-col gap-3">
			{#each data.drafts as draft (draft.id)}
				{@const type = typeOf(draft)}
				{@const cover = draft.payload.mediaUrls[0]}
				<li
					class="rounded-3xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card p-4 flex gap-3"
				>
					{#if cover}
						<div class="shrink-0 size-16 rounded-2xl overflow-hidden bg-slate-900">
							{#if cover.type === 'video'}
								<video
									src={cover.url}
									class="w-full h-full object-cover"
									muted
									playsinline
									preload="metadata"
								></video>
							{:else}
								<img src={cover.url} alt={cover.alt ?? ''} class="w-full h-full object-cover" />
							{/if}
						</div>
					{/if}

					<div class="flex-1 min-w-0 flex flex-col gap-1.5">
						<div class="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-dark-muted">
							<Icon name={type.icon} class="text-xs" />
							<span>{type.label}</span>
							<span aria-hidden="true">·</span>
							<span>Edited {formatTimeAgo(draft.updatedAt)}</span>
						</div>

						{#if draft.payload.title}
							<p class="m-0 text-sm font-semibold text-slate-950 dark:text-white truncate">
								{draft.payload.title}
							</p>
						{/if}
						<p
							class="m-0 text-sm text-slate-700 dark:text-dark-text line-clamp-3 whitespace-pre-line break-words"
						>
							{draft.payload.content}
						</p>

						{#if draft.publishAt}
							<p
								class="m-0 flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-kizuna-blue"
							>
								<Icon name="clock" class="text-xs" />
								<span>Scheduled for {formatPublishAt(draft.publishAt)}</span>
							</p>
						{/if}
						{#if draft.lastError}
							<p class="m-0 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
								<Icon name="exclamation" class="text-xs shrink-0" />
								<span>Could not publish: {draft.lastError}</span>
							</p>
						{/if}

						<div class="flex flex-wrap items-center gap-2 pt-1">
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() is the base; only a query is added -->
							<a
								href="{resolve('/')}?draft={encodeURIComponent(draft.id)}"
								class="h-9 px-4 rounded-full text-xs font-semibold bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text hover:bg-slate-200 dark:hover:bg-dark-hover no-underline flex items-center gap-1.5 transition-colors"
							>
								<Icon name="pencil" class="text-xs" />
								<span>Edit</span>
							</a>
							<button
								type="button"
								disabled={busyId !== null}
								onclick={() => publishNow(draft)}
								class="h-9 px-4 rounded-full text-xs font-semibold bg-slate-950 dark:bg-white text-white dark:text-slate-950 border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition"
							>
								<span>{busyId === draft.id && !confirmOpen ? 'Publishing…' : 'Publish now'}</span>
								<Icon name="arrow-right" class="text-[10px]" />
							</button>
							<button
								type="button"
								disabled={busyId !== null}
								onclick={() => confirmDelete(draft)}
								class="ml-auto h-9 px-4 rounded-full text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/60 border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
							>
								Delete
							</button>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</main>

{#if confirmOpen}
	<BottomSheet bind:open={confirmOpen} title="Delete draft?" showTitle>
		<p class="px-3 pb-2 text-sm text-slate-600 dark:text-dark-muted">
			This deletes the draft and the photos and videos uploaded for it. You can't undo this.
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
					class="h-10 px-5 rounded-full text-sm font-semibold bg-red-600 text-white border-0 cursor-pointer hover:bg-red-700 disabled:opacity-50 disabled:cursor-default"
					disabled={busyId !== null}
					onclick={deletePending}
				>
					{busyId ? 'Deleting…' : 'Delete'}
				</button>
			</div>
		{/snippet}
	</BottomSheet>
{/if}
