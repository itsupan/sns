<!-- A page with a trigger, a modal, and a second modal opened from inside the first. -->
<script lang="ts">
	import Modal from '$lib/components/shared/Modal.svelte';

	interface Props {
		closeOnBackdrop?: boolean;
		onclose?: () => void;
	}

	let { closeOnBackdrop, onclose }: Props = $props();

	let open = $state(false);
	let nested = $state(false);
</script>

<button type="button" onclick={() => (open = true)}>Open</button>

<Modal bind:open label="Outer" {closeOnBackdrop} {onclose}>
	<div class="w-64 bg-white p-4">
		<p>Outer content</p>
		<button type="button">First</button>
		<!-- svelte-ignore a11y_autofocus -->
		<button type="button" autofocus onclick={() => (nested = true)}>Open nested</button>
	</div>
	<Modal bind:open={nested} label="Inner">
		<div class="w-48 bg-white p-4">
			<button type="button">Inner action</button>
		</div>
	</Modal>
</Modal>
