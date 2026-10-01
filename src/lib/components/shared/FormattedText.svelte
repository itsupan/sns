<script lang="ts">
	import { renderFormatted } from '$lib/formatting';

	interface Props {
		text: string;
		class?: string;
	}

	let { text, class: className = '' }: Props = $props();

	const html = $derived(renderFormatted(text));
</script>

<div
	class="break-words [&_p]:m-0 [&_p+p]:mt-3 [&_p+ul]:mt-2 [&_p+ol]:mt-2 [&_ul+p]:mt-2 [&_ol+p]:mt-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_ul]:my-0 [&_ol]:my-0 [&_strong]:font-semibold {className}"
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- renderFormatted escapes all HTML first and only emits a fixed tag whitelist -->
	{@html html}
</div>
