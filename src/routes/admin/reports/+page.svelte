<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import ResolveSheet from '$lib/components/admin/ResolveSheet.svelte';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import LoadMore from '$lib/components/shared/LoadMore.svelte';
	import { REPORT_REASON_OPTIONS } from '$lib/components/shared/ReportSheet.svelte';
	import type { ResolveAction } from '$lib/moderation';
	import { readApiError } from '$lib/utils/api-error';
	import { displayHandle, formatTimeAgo } from '$lib/utils/format';
	import { m } from '$lib/i18n';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Item = (typeof data.items)[number];

	const keyOf = (item: Item) => `${item.targetType}:${item.targetId}`;
	const REASON_LABEL = new Map<string, string>(
		REPORT_REASON_OPTIONS.map((o) => [o.value, o.label])
	);
	const TYPE_LABEL = {
		post: m.moderation_type_post(),
		comment: m.moderation_type_comment(),
		user: m.moderation_type_user(),
		message: m.moderation_type_message()
	};

	/** Pages loaded while scrolling, appended after the server-rendered first page. */
	let more = $state<Item[]>([]);
	let moreCursor = $state<string | null | undefined>(undefined);
	let loadingMore = $state(false);
	let loadError = $state<string | null>(null);
	let resolved = $state<string[]>([]);

	let items = $derived.by(() => {
		const seen = new SvelteSet(resolved);
		return [...data.items, ...more].filter((item) => {
			const key = keyOf(item);
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	});
	let nextCursor = $derived(moreCursor === undefined ? data.nextCursor : moreCursor);

	let pending = $state<{ item: Item; action: ResolveAction } | null>(null);
	let sheetOpen = $state(false);

	function confirm(item: Item, action: ResolveAction) {
		pending = { item, action };
		sheetOpen = true;
	}

	function contentHref(item: Item) {
		const target = item.target;
		if (!target) return null;
		if (item.targetType === 'user') {
			return resolve('/profile/[id]', { id: target.owner.handle || target.owner.id });
		}
		return target.postId && !target.removed ? resolve('/post/[id]', { id: target.postId }) : null;
	}

	async function loadMore() {
		if (!nextCursor || loadingMore) return;
		loadingMore = true;
		loadError = null;
		try {
			const res = await fetch(`/api/admin/reports?cursor=${encodeURIComponent(nextCursor)}`);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				loadError = readApiError(body, m.moderation_reports_load_error()).message;
				return;
			}
			const page = body as { items: Item[]; nextCursor: string | null };
			more = [...more, ...page.items];
			moreCursor = page.nextCursor;
		} catch {
			loadError = m.moderation_reports_load_error();
		} finally {
			loadingMore = false;
		}
	}
</script>

<svelte:head><title>{m.moderation_reports_title()}</title></svelte:head>

{#if items.length === 0}
	<p
		class="m-0 rounded-2xl border border-slate-100 dark:border-dark-border bg-white dark:bg-dark-card py-12 px-6 text-center text-sm text-slate-500 dark:text-dark-muted"
	>
		{m.moderation_no_reports()}
	</p>
{:else}
	<ul class="list-none m-0 p-0 flex flex-col gap-3">
		{#each items as item (keyOf(item))}
			{@const target = item.target}
			{@const href = contentHref(item)}
			<li
				data-testid="report"
				class="rounded-2xl border border-slate-100 dark:border-dark-border bg-white dark:bg-dark-card p-4 flex flex-col gap-3"
			>
				<div class="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-dark-muted">
					<span
						class="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-dark-elevated font-semibold text-slate-700 dark:text-dark-text"
					>
						{TYPE_LABEL[item.targetType]}
					</span>
					<span class="font-semibold text-red-600 dark:text-red-400">
						{m.moderation_report_count(item.reportCount)}
					</span>
					<span>{item.reasons.map((r) => REASON_LABEL.get(r) ?? r).join(', ')}</span>
					<span class="ml-auto">{formatTimeAgo(item.latestReportAt)}</span>
				</div>

				{#if target}
					<div class="flex items-center gap-2">
						<Avatar src={target.owner.image} name={target.owner.name} size="sm" />
						<div class="flex flex-col min-w-0">
							<span class="text-sm font-semibold text-slate-900 dark:text-dark-text truncate">
								{target.owner.name}
							</span>
							<span class="text-xs text-slate-500 dark:text-dark-muted">
								{displayHandle(target.owner.handle, target.owner.name)}
								{#if target.owner.role !== 'user'}· {target.owner.role}{/if}
								{#if target.owner.banned}· {m.moderation_suspended()}{/if}
							</span>
						</div>
					</div>
					{#if target.text}
						<p
							class="m-0 text-sm text-slate-800 dark:text-dark-text whitespace-pre-wrap break-words line-clamp-6"
						>
							{target.text}
						</p>
					{/if}
					{#if target.media}
						{#if target.media.type === 'image'}
							<img
								src={target.media.url}
								alt={target.media.alt || m.moderation_media_alt()}
								loading="lazy"
								class="max-h-64 w-fit rounded-xl object-contain bg-slate-50 dark:bg-dark-elevated"
							/>
						{:else}
							<!-- svelte-ignore a11y_media_has_caption -->
							<video
								src={target.media.url}
								controls
								preload="metadata"
								class="max-h-64 w-fit rounded-xl bg-black"
							></video>
						{/if}
					{/if}
					{#if target.removed}
						<p class="m-0 text-xs text-slate-500 dark:text-dark-muted">
							{m.moderation_already_removed()}
						</p>
					{/if}
				{:else}
					<p class="m-0 text-sm text-slate-500 dark:text-dark-muted">
						{m.moderation_content_gone()}
					</p>
				{/if}

				<div class="flex flex-wrap items-center gap-2">
					{#if href}
						<a
							{href}
							class="text-xs font-medium text-slate-700 dark:text-dark-text underline mr-auto"
						>
							{m.moderation_view()}
						</a>
					{/if}
					<button
						type="button"
						class="ml-auto h-9 px-4 rounded-full text-xs font-semibold bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text hover:bg-slate-200 dark:hover:bg-dark-hover border-0 cursor-pointer"
						onclick={() => confirm(item, 'dismiss')}
					>
						{m.moderation_confirm_dismiss()}
					</button>
					{#if target && !target.removed && item.targetType !== 'user'}
						<button
							type="button"
							class="h-9 px-4 rounded-full text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/60 border-0 cursor-pointer"
							onclick={() => confirm(item, 'remove_content')}
						>
							{m.moderation_confirm_remove()}
						</button>
					{/if}
					{#if target}
						<button
							type="button"
							class="h-9 px-4 rounded-full text-xs font-semibold text-white bg-red-600 hover:bg-red-700 border-0 cursor-pointer"
							onclick={() => confirm(item, 'suspend_user')}
						>
							{m.moderation_title_suspend()}
						</button>
					{/if}
				</div>
			</li>
		{/each}
	</ul>

	{#if nextCursor}
		<LoadMore onLoad={loadMore} loading={loadingMore} error={loadError} />
	{/if}
{/if}

{#if pending}
	{@const { item, action } = pending}
	<ResolveSheet
		bind:open={sheetOpen}
		{action}
		targetType={item.targetType}
		targetId={item.targetId}
		ownerName={item.target?.owner.name ?? null}
		onresolved={() => (resolved = [...resolved, keyOf(item)])}
	/>
{/if}
