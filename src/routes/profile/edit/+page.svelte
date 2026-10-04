<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/shared/Icon.svelte';
	import ProfileSettingsForm from '$lib/components/profile/ProfileSettingsForm.svelte';
	import { m } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data?: PageData } = $props();

	const user = $derived(data?.user);

	async function handleSuccess() {
		// Reload server data on the way, so /profile shows the saved values.
		await goto(resolve('/profile'), { invalidateAll: true });
	}

	function handleCancel() {
		goto(resolve('/profile'));
	}
</script>

<svelte:head>
	<title>{m.profile_edit_page_title()}</title>
	<meta name="description" content={m.profile_edit_page_description()} />
</svelte:head>

<main class="w-full flex-1 flex flex-col items-center px-4 py-4 sm:py-8">
	<div class="w-full max-w-2xl mx-auto flex flex-col gap-4">
		<!-- Back link -->
		<a
			href={resolve('/profile')}
			class="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-dark-muted hover:text-slate-900 dark:hover:text-dark-text no-underline self-start transition-colors"
		>
			<Icon name="angle-left" class="text-base" />
			<span>{m.profile_back()}</span>
		</a>

		<ProfileSettingsForm
			initialData={user}
			userId={user?.id}
			onSuccess={handleSuccess}
			onCancel={handleCancel}
		/>
	</div>
</main>
