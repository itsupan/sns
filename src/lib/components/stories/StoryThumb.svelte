<script lang="ts">
	import type { SavedStory } from '$lib/highlights';

	/** A story's still: the photo or the first frame of the video. Decorative: label the control. */
	let { story }: { story: Pick<SavedStory, 'mediaUrl' | 'mediaType'> } = $props();
</script>

{#if story.mediaType === 'video'}
	<video
		src={story.mediaUrl}
		class="w-full h-full object-cover"
		muted
		playsinline
		preload="metadata"
		aria-hidden="true"
	></video>
{:else}
	<img src={story.mediaUrl} alt="" class="w-full h-full object-cover" loading="lazy" />
{/if}
