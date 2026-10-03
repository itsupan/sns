<script lang="ts">
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { stripFormatting } from '$lib/formatting';
	import { GRID_IMAGE_WIDTHS, imageSrcset } from '$lib/utils/image';
	import { resolve } from '$app/paths';
	import type { QuotedPost } from './PostCard.svelte';

	interface Props {
		/** The quoted post; null once it is deleted or hidden from the viewer. */
		quoted: QuotedPost | null;
	}

	let { quoted }: Props = $props();

	let cover = $derived(quoted?.mediaItems?.[0]);
</script>

{#if quoted}
	<a
		href={resolve('/post/[id]', { id: quoted.id })}
		class="flex gap-3 p-3 rounded-2xl border border-slate-200 dark:border-dark-border no-underline hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors"
		aria-label={`Quoted post by ${quoted.author.name}`}
		data-testid="quoted-post"
	>
		<div class="flex-1 min-w-0 flex flex-col gap-1">
			<div class="flex items-center gap-1.5 min-w-0 text-xs">
				<Avatar src={quoted.author.avatar} name={quoted.author.name} size="xs" />
				<span class="font-semibold text-slate-900 dark:text-dark-text truncate">
					{quoted.author.name}
				</span>
				<span class="text-slate-500 dark:text-dark-muted truncate">{quoted.author.handle}</span>
				{#if quoted.author.timeAgo}
					<span class="text-slate-400 dark:text-dark-subtle shrink-0" aria-hidden="true">•</span>
					<span class="text-slate-500 dark:text-dark-subtle shrink-0">
						{quoted.author.timeAgo}
					</span>
				{/if}
			</div>
			{#if quoted.title}
				<p class="m-0 text-sm font-semibold text-slate-950 dark:text-white truncate">
					{quoted.title}
				</p>
			{/if}
			<p class="m-0 text-sm leading-snug text-slate-700 dark:text-dark-muted line-clamp-3">
				{stripFormatting(quoted.description)}
			</p>
		</div>
		{#if cover}
			<div
				class="relative shrink-0 size-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-dark-elevated"
			>
				{#if cover.type === 'image'}
					<img
						src={cover.url}
						alt={cover.alt ?? ''}
						srcset={imageSrcset(cover.url, GRID_IMAGE_WIDTHS)}
						sizes="64px"
						class="w-full h-full object-cover"
						loading="lazy"
						decoding="async"
					/>
				{:else}
					<video
						src={cover.url}
						class="w-full h-full object-cover"
						muted
						playsinline
						preload="metadata"
					></video>
					<span class="absolute top-1 right-1 text-white drop-shadow" aria-hidden="true">
						<Icon name="play" type="sr" size="sm" />
					</span>
				{/if}
			</div>
		{/if}
	</a>
{:else}
	<p
		class="m-0 p-3 rounded-2xl border border-slate-200 dark:border-dark-border text-sm text-slate-500 dark:text-dark-muted"
		data-testid="quoted-post"
	>
		This post is unavailable.
	</p>
{/if}
