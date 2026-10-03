<script lang="ts">
	import { resolve } from '$app/paths';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import LoadMore from '$lib/components/shared/LoadMore.svelte';
	import FollowRequests from '$lib/components/activity/FollowRequests.svelte';
	import { formatTimeAgo } from '$lib/utils/format';
	import { readApiError } from '$lib/utils/api-error';
	import { badges } from '$lib/utils/badges.svelte';
	import { activityVerb, actorNames, groupActivity } from '$lib/activity/group';
	import type { ActivityItem, ActivityPage, ActivityType } from '$lib/activity/types';
	import type { IconName } from '$lib/components/shared/icons';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Pages loaded while scrolling, appended after the server-rendered first page. */
	let more = $state<ActivityItem[]>([]);
	let moreCursor = $state<string | null | undefined>(undefined);
	let loadingMore = $state(false);
	let loadError = $state<string | null>(null);

	let items = $derived.by(() => {
		const seen = new Set(data.items.map((i) => i.id));
		return [...data.items, ...more.filter((i) => !seen.has(i.id))];
	});
	let groups = $derived(groupActivity(items));
	let nextCursor = $derived(moreCursor === undefined ? data.nextCursor : moreCursor);

	// Opening Activity reads everything shown; newer activity arriving later stays unread.
	$effect(() => {
		const newest = data.items[0];
		if (!newest?.unread) return;
		fetch('/api/notifications/read', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ upTo: newest.createdAt })
		})
			.then(() => badges.refresh())
			.catch(() => {
				// The badge stays until the next visit.
			});
	});

	async function loadMore() {
		if (!nextCursor || loadingMore) return;
		loadingMore = true;
		loadError = null;
		try {
			const res = await fetch(`/api/notifications?cursor=${encodeURIComponent(nextCursor)}`);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				loadError = readApiError(body, 'Could not load activity').message;
				return;
			}
			const page = body as ActivityPage;
			more = [...more, ...page.items];
			moreCursor = page.nextCursor;
		} catch {
			loadError = 'Could not load activity';
		} finally {
			loadingMore = false;
		}
	}

	const typeIcon: Record<ActivityType, IconName> = {
		like: 'heart',
		comment: 'comment',
		reply: 'comment',
		reaction: 'smile',
		follow: 'user-add',
		mention: 'at',
		story_reaction: 'smile',
		follow_request: 'user-add',
		follow_accepted: 'check'
	};
</script>

<svelte:head>
	<title>Activity · Kizuna</title>
</svelte:head>

<main class="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
	<h1 class="text-xl font-bold tracking-tight text-slate-950 dark:text-white m-0">Activity</h1>

	<FollowRequests initial={data.requests} />

	{#if groups.length === 0}
		<div
			class="rounded-3xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card py-16 px-6 flex flex-col items-center gap-2 text-center"
		>
			<Icon name="heart" class="text-3xl text-slate-300" />
			<p class="text-sm font-semibold text-slate-900 dark:text-dark-text m-0">No activity yet</p>
			<p class="text-xs text-slate-500 dark:text-dark-muted m-0">
				Likes, comments, tags and new followers will show up here.
			</p>
		</div>
	{:else}
		<ul
			class="list-none m-0 p-0 rounded-3xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card divide-y divide-slate-100 dark:divide-dark-border overflow-hidden"
		>
			{#each groups as group (group.key)}
				{@const lead = group.actors[0]}
				<li
					data-testid="activity"
					class="flex items-center gap-3 px-4 py-3 {group.unread
						? 'bg-blue-50/60 dark:bg-blue-950/20'
						: ''}"
				>
					<a
						href={resolve('/profile/[id]', { id: lead.slug })}
						class="relative shrink-0 no-underline"
						aria-label={lead.name}
					>
						<Avatar src={lead.image ?? ''} name={lead.name} size="md" />
						<span
							class="absolute -bottom-1 -right-1 size-5 rounded-full bg-white dark:bg-dark-card flex items-center justify-center {group.type ===
							'like'
								? 'text-rose-600'
								: 'text-slate-600 dark:text-dark-muted'}"
							aria-hidden="true"
						>
							<Icon name={typeIcon[group.type]} type="sr" size={10} />
						</span>
					</a>
					<div class="min-w-0 flex-1">
						<p class="text-sm m-0 text-slate-700 dark:text-dark-text leading-snug">
							<a
								href={resolve('/profile/[id]', { id: lead.slug })}
								class="font-semibold text-slate-950 dark:text-white no-underline hover:underline"
								>{actorNames(group.actors)}</a
							>
							{activityVerb(group)}
							<span class="text-xs text-slate-400 whitespace-nowrap"
								>· {formatTimeAgo(group.createdAt)}</span
							>
						</p>
						{#if group.comment && (group.type === 'comment' || group.type === 'reply')}
							<p class="text-xs text-slate-500 dark:text-dark-muted m-0 mt-0.5 truncate">
								“{group.comment.content}”
							</p>
						{/if}
					</div>
					{#if group.unread}
						<span class="size-2 rounded-full bg-blue-600 shrink-0" aria-label="New"></span>
					{/if}
					{#if group.post}
						<a
							href={resolve('/post/[id]', { id: group.post.id })}
							class="shrink-0 size-11 rounded-lg overflow-hidden bg-slate-100 dark:bg-dark-elevated flex items-center justify-center no-underline"
							aria-label="View post"
						>
							{#if group.post.thumbnail}
								<img
									src={group.post.thumbnail}
									alt=""
									class="w-full h-full object-cover"
									loading="lazy"
								/>
							{:else}
								<Icon name="document" class="text-slate-400" />
							{/if}
						</a>
					{/if}
				</li>
			{/each}
		</ul>

		{#if nextCursor}
			<LoadMore onLoad={loadMore} loading={loadingMore} error={loadError} />
		{/if}
	{/if}
</main>
