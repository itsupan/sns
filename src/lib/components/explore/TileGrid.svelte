<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { formatCount } from '$lib/utils/format';
	import type { ExploreTile } from '$lib/explore/types';

	let { tiles }: { tiles: ExploreTile[] } = $props();
</script>

<ul class="grid grid-cols-3 gap-0.5 sm:gap-1 list-none m-0 p-0">
	{#each tiles as tile, i (tile.id)}
		<li>
			<a
				href={resolve('/post/[id]', { id: tile.id })}
				class="group relative block aspect-square overflow-hidden bg-slate-100 dark:bg-dark-elevated no-underline"
				aria-label={tile.title}
				data-testid="tile"
			>
				{#if tile.cover?.type === 'image'}
					<img
						src={tile.cover.url}
						alt=""
						class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
						loading={i < 6 ? 'eager' : 'lazy'}
					/>
				{:else if tile.cover?.type === 'video'}
					<video
						src={tile.cover.url}
						class="w-full h-full object-cover"
						muted
						playsinline
						preload="metadata"
					></video>
				{:else}
					<p
						class="w-full h-full m-0 p-3 text-xs leading-snug text-slate-700 dark:text-dark-text overflow-hidden"
					>
						{tile.title}
					</p>
				{/if}

				{#if tile.isCarousel || tile.cover?.type === 'video'}
					<span class="absolute top-2 right-2 text-white drop-shadow" aria-hidden="true">
						<Icon name={tile.cover?.type === 'video' ? 'play' : 'copy'} type="sr" size="sm" />
					</span>
				{/if}

				<span
					class="absolute inset-0 hidden group-hover:flex items-center justify-center gap-4 bg-black/35 text-white text-sm font-semibold"
					aria-hidden="true"
				>
					<span class="flex items-center gap-1"
						><Icon name="heart" type="sr" size="sm" />{formatCount(tile.likes)}</span
					>
					<span class="flex items-center gap-1"
						><Icon name="comment" type="sr" size="sm" />{formatCount(tile.comments)}</span
					>
				</span>
			</a>
		</li>
	{/each}
</ul>
