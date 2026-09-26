<script lang="ts">
	interface Highlight {
		id: string;
		title: string;
		image: string;
	}

	interface Props {
		highlights?: Highlight[];
		class?: string;
		onSelectHighlight?: (highlight: Highlight) => void;
	}

	const defaultHighlights: Highlight[] = [
		{
			id: 'h1',
			title: "Kyoto '23",
			image:
				'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=200&auto=format&fit=crop&q=80'
		},
		{
			id: 'h2',
			title: 'Nordic Light',
			image:
				'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&auto=format&fit=crop&q=80'
		},
		{
			id: 'h3',
			title: 'Gear & EXIF',
			image:
				'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=200&auto=format&fit=crop&q=80'
		},
		{
			id: 'h4',
			title: 'Exhibitions',
			image:
				'https://images.unsplash.com/photo-1544816155-12df9643f363?w=200&auto=format&fit=crop&q=80'
		},
		{
			id: 'h5',
			title: 'Architecture Studies',
			image:
				'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=200&auto=format&fit=crop&q=80'
		}
	];

	let {
		highlights = defaultHighlights,
		class: className = '',
		onSelectHighlight
	}: Props = $props();
</script>

<div
	class="w-full py-4 sm:py-6 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-px-4 select-none {className}"
	aria-label="Story Highlights"
>
	<div class="flex items-center gap-4 sm:gap-6 min-w-max px-4 sm:px-0">
		{#each highlights as item (item.id)}
			<button
				type="button"
				class="group snap-start flex flex-col items-center gap-2 cursor-pointer bg-transparent border-0 p-0 text-inherit rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 dark:focus-visible:outline-kizuna-blue active:scale-95 transition-transform"
				onclick={() => onSelectHighlight?.(item)}
				aria-label={`View highlight ${item.title}`}
			>
				<!-- Highlight Circle -->
				<div
					class="size-16 sm:size-18 rounded-full p-0.5 ring-1.5 ring-slate-200 dark:ring-dark-border group-hover:ring-slate-950 dark:group-hover:ring-white transition-all duration-150"
				>
					<div
						class="w-full h-full rounded-full overflow-hidden bg-slate-100 dark:bg-dark-elevated"
					>
						<img
							src={item.image}
							alt={item.title}
							class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
						/>
					</div>
				</div>

				<!-- Label -->
				<span
					class="text-xs font-medium text-slate-800 dark:text-dark-text tracking-tight group-hover:text-black dark:group-hover:text-white transition-colors"
				>
					{item.title}
				</span>
			</button>
		{/each}
	</div>
</div>
