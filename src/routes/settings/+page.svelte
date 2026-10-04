<script lang="ts">
	import {
		AccountSection,
		BlockedUsersSection,
		CloseFriendsSection,
		LegalSection,
		LogOutButton,
		NotificationsSection,
		MutedSection,
		PrivacyDataSection,
		PrivateAccountSection,
		SecuritySection,
		TwoFactorSection
	} from '$lib/components/settings';
	import { m } from '$lib/i18n';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>{m.settings_page_title()}</title></svelte:head>

<main class="w-full max-w-2xl mx-auto px-4 py-6 sm:py-10 flex flex-col gap-6">
	<h1 class="text-2xl font-bold m-0">{m.settings_title()}</h1>

	<AccountSection isModerator={data.isModerator} />
	<SecuritySection
		email={data.email}
		emailVerified={data.emailVerified}
		hasPassword={data.hasPassword}
		socialProviders={data.socialProviders}
		sessions={data.sessions}
	/>
	<TwoFactorSection hasPassword={data.hasPassword} enabled={data.twoFactorEnabled} />
	<PrivateAccountSection userId={data.userId} isPrivate={data.isPrivate} />
	<NotificationsSection />
	<PrivacyDataSection hasPassword={data.hasPassword} />
	<BlockedUsersSection users={data.blockedUsers} />
	<MutedSection users={data.mutedUsers} keywords={data.mutedKeywords} />
	<CloseFriendsSection users={data.closeFriends} />
	<LegalSection />
	<LogOutButton />
</main>
