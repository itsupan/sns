<script lang="ts">
	import ConversationView from '$lib/components/chat/ConversationView.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.conversation.other.name} · Messages · Kizuna</title>
</svelte:head>

{#key data.conversation.id}
	<ConversationView
		conversationId={data.conversation.id}
		other={data.conversation.other}
		viewerId={data.viewerId}
		initialMessages={data.messages}
		initialCursor={data.nextCursor}
	/>
{/key}
