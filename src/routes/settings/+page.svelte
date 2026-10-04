<script lang="ts">
	import {
		AccountSection,
		BlockedUsersSection,
		LegalSection,
		LogOutButton,
		NotificationsSection,
		PrivacyDataSection,
		PrivateAccountSection,
		SecuritySection
	} from '$lib/components/settings';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Settings · Kizuna</title></svelte:head>

<main class="w-full max-w-2xl mx-auto px-4 py-6 sm:py-10 flex flex-col gap-6">
	<h1 class="text-2xl font-bold m-0">Settings</h1>

	<AccountSection isModerator={data.isModerator} />
	<SecuritySection
		email={data.email}
		emailVerified={data.emailVerified}
		hasPassword={data.hasPassword}
		socialProviders={data.socialProviders}
		sessions={data.sessions}
	/>
	<PrivateAccountSection userId={data.userId} isPrivate={data.isPrivate} />
	<NotificationsSection />
	<PrivacyDataSection hasPassword={data.hasPassword} />
	<BlockedUsersSection users={data.blockedUsers} />
	<LegalSection />
	<LogOutButton />
</main>
