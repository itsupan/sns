<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import Icon from '$lib/components/shared/Icon.svelte';

	let signingOut = $state(false);

	async function signOut() {
		signingOut = true;
		await authClient.signOut();
		await goto(resolve('/login'));
	}
</script>

<button
	type="button"
	class="self-start inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/60 border-0 cursor-pointer disabled:opacity-60"
	onclick={signOut}
	disabled={signingOut}
>
	<Icon name="sign-out-alt" />
	Log out
</button>
