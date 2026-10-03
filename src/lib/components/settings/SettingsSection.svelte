<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Id of the heading, which labels the section. */
		id: string;
		title: string;
		children: Snippet;
	}

	let { id, title, children }: Props = $props();
</script>

<section aria-labelledby={id}>
	<h2
		{id}
		class="px-1 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-dark-subtle"
	>
		{title}
	</h2>
	<div
		class="bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border rounded-2xl divide-y divide-slate-100 dark:divide-dark-border overflow-hidden"
	>
		{@render children()}
	</div>
</section>
