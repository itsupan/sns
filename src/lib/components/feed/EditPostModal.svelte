<script lang="ts">
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';
	import Icon from '$lib/components/shared/Icon.svelte';
	import { toast } from '$lib/utils/toast.svelte';
	import { readApiError } from '$lib/utils/api-error';
	import PostComposerFields from './PostComposerFields.svelte';
	import { PostDraft } from './post-draft.svelte';
	import type { PostData } from './PostCard.svelte';

	/** Fields the server returns after an edit; merged over the post the card was given. */
	export type PostEdits = Pick<
		PostData,
		| 'title'
		| 'description'
		| 'location'
		| 'tags'
		| 'image'
		| 'mediaUrl'
		| 'mediaType'
		| 'mediaItems'
		| 'aspectRatio'
		| 'postType'
	>;

	interface Props {
		open?: boolean;
		post: PostData;
		onSaved?: (edits: PostEdits) => void;
	}

	let { open = $bindable(false), post, onSaved }: Props = $props();

	// Same draft and fields as the create composer, pre-filled from the post on every open.
	let draft = $state(new PostDraft());
	let hadTitle = $state(false);
	let saving = $state(false);

	$effect(() => {
		if (!open) return;
		draft = PostDraft.fromPost(post);
		hadTitle = Boolean(post.title);
	});

	let saveDisabled = $derived(draft.isEmpty || saving || draft.isUploadingAny);

	async function save() {
		if (saveDisabled) return;
		saving = true;
		try {
			const res = await fetch(`/api/posts/${post.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(draft.toPayload())
			});
			const body = (await res.json().catch(() => null)) as { post?: PostEdits } | null;
			if (!res.ok || !body?.post) {
				toast.show(readApiError(body, 'Could not save your changes').message);
				return;
			}
			onSaved?.(body.post);
			open = false;
			toast.show('Post updated');
		} catch {
			toast.show('Could not save your changes');
		} finally {
			saving = false;
		}
	}
</script>

<BottomSheet bind:open title="Edit post" showTitle>
	<PostComposerFields {draft} id="edit-post-{post.id}" onsubmit={save} alwaysShowTitle={hadTitle} />

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
				form="edit-post-{post.id}"
				disabled={saveDisabled}
				class="flex-1 h-12 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-semibold text-sm border-0 cursor-pointer active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
			>
				<span>{saving ? 'Saving…' : 'Save changes'}</span>
				<Icon name="check" class="text-xs" />
			</button>
		</div>
	{/snippet}
</BottomSheet>
