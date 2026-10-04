<script lang="ts">
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { toast } from '$lib/utils/toast.svelte';
	import { readApiError } from '$lib/utils/api-error';
	import PostComposerFields from './PostComposerFields.svelte';
	import QuotedPostCard from './QuotedPostCard.svelte';
	import { PostDraft } from './post-draft.svelte';
	import type { PostData } from './PostCard.svelte';

	interface Props {
		open?: boolean;
		/** The post being quoted. */
		post: PostData;
	}

	let { open = $bindable(false), post }: Props = $props();

	const draft = new PostDraft();
	let publishing = $state(false);
	let publishDisabled = $derived(draft.isEmpty || publishing || draft.isUploadingAny);

	async function publish() {
		if (publishDisabled) return;
		publishing = true;
		try {
			const res = await fetch('/api/posts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...draft.toPayload(), quoteOfId: post.id })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				toast.show(readApiError(body, 'Could not publish your quote').message);
				return;
			}
			open = false;
			toast.show('Quote published');
		} catch {
			toast.show('Could not publish your quote');
		} finally {
			publishing = false;
		}
	}
</script>

<BottomSheet bind:open title="Quote post" showTitle>
	<PostComposerFields {draft} id="quote-post-{post.id}" onsubmit={publish}>
		{#snippet attachment()}
			<QuotedPostCard quoted={post} />
		{/snippet}
	</PostComposerFields>

	{#snippet footer()}
		<div class="flex items-center gap-3 w-full">
			<button
				type="button"
				onclick={() => (open = false)}
				class="px-5 h-12 rounded-full bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-dark-text font-semibold text-xs border-0 cursor-pointer"
			>
				Cancel
			</button>
			<button
				type="submit"
				form="quote-post-{post.id}"
				disabled={publishDisabled}
				class="flex-1 h-12 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-semibold text-sm border-0 cursor-pointer active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
			>
				<span>{publishing ? 'Publishing…' : 'Publish'}</span>
				<Icon name="arrow-right" class="text-xs" />
			</button>
		</div>
	{/snippet}
</BottomSheet>
