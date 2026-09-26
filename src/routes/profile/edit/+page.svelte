<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/shared/Icon.svelte';
	import ProfileSettingsForm from '$lib/components/profile/ProfileSettingsForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data?: PageData } = $props();

	const user = $derived(data?.user);

	function handleSuccess() {
		goto(resolve('/profile'));
	}

	function handleCancel() {
		goto(resolve('/profile'));
	}
</script>

<svelte:head>
	<title>Edit Profile — Kizuna</title>
	<meta name="description" content="Edit your Kizuna profile, bio, and settings" />
</svelte:head>

<main class="w-full flex-1 flex flex-col items-center px-4 py-4 sm:py-8">
	<div class="w-full max-w-2xl mx-auto flex flex-col gap-4">
		<!-- Back link -->
		<a
			href={resolve('/profile')}
			class="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text no-underline self-start transition-colors"
		>
			<Icon name="angle-small-left" class="text-base" />
			<span>Back to Profile</span>
		</a>

		<ProfileSettingsForm
			initialData={user}
			userId={user?.id}
			onSuccess={handleSuccess}
			onCancel={handleCancel}
		/>
	</div>
</main>
