<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import AuthAlert from '$lib/components/auth/AuthAlert.svelte';
	import { inputClass, labelClass } from '$lib/components/auth/styles';
	import AvatarUpload from '$lib/components/profile/AvatarUpload.svelte';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import KizunaLogo from '$lib/components/shared/KizunaLogo.svelte';
	import { readApiError } from '$lib/utils/api-error';
	import { FOLLOW_LABELS, followActionLabel, followStore } from '$lib/utils/follow.svelte';
	import { HANDLE_PATTERN, HANDLE_RULES, normalizeHandle } from '$lib/utils/handle';
	import { toast } from '$lib/utils/toast.svelte';
	import { m } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const STEPS = [
		{ title: m.welcome_handle_title(), description: m.welcome_handle_description() },
		{ title: m.welcome_profile_title(), description: m.welcome_profile_description() },
		{ title: m.welcome_follow_title(), description: m.welcome_follow_description() },
		{ title: m.welcome_done_title(), description: m.welcome_done_description() }
	];
	const BIO_MAX = 500;
	const AVAILABILITY_DELAY_MS = 300;

	let step = $state(0);
	let heading = $state<HTMLHeadingElement>();
	let saving = $state(false);
	let errorMessage = $state<string | null>(null);

	const initial = untrack(() => data);
	// What is stored, so a step with nothing changed skips the save.
	let saved = $state({ ...initial.user });

	let handle = $state(initial.suggestedHandle);
	let availability = $state<'checking' | 'available' | 'taken' | 'invalid' | 'error'>('checking');
	const candidate = $derived(normalizeHandle(handle));

	let avatarUrl = $state(initial.user.image ?? '');
	let uploading = $state(false);
	let bio = $state(initial.user.bio ?? '');

	const followedAny = $derived(
		data.suggestions.some((creator) => followStore.status(creator.id) !== 'none')
	);

	const handleMessage = $derived.by(() => {
		if (!candidate) return m.welcome_handle_empty();
		switch (availability) {
			case 'checking':
				return m.welcome_handle_checking();
			case 'available':
				return m.welcome_handle_available(candidate);
			case 'taken':
				return m.welcome_handle_taken(candidate);
			case 'invalid':
				return HANDLE_RULES;
			case 'error':
				return m.welcome_handle_error();
		}
	});

	$effect(() => {
		const value = candidate;
		if (!HANDLE_PATTERN.test(value)) {
			availability = 'invalid';
			return;
		}
		availability = 'checking';
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res = await fetch(
					`/api/users/handle-availability?handle=${encodeURIComponent(value)}`,
					{ signal: controller.signal }
				);
				const body = (await res.json().catch(() => null)) as { available?: boolean } | null;
				if (!res.ok) availability = 'error';
				else availability = body?.available ? 'available' : 'taken';
			} catch {
				if (!controller.signal.aborted) availability = 'error';
			}
		}, AVAILABILITY_DELAY_MS);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	async function goTo(next: number) {
		errorMessage = null;
		step = next;
		await tick();
		heading?.focus();
	}

	/** Saves `changes` through the profile API; `false` (with the error shown) when it fails. */
	async function saveProfile(changes: Record<string, string | null>): Promise<boolean> {
		saving = true;
		errorMessage = null;
		try {
			const res = await fetch(`/api/users/${encodeURIComponent(data.user.id)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(changes)
			});
			const body = (await res.json().catch(() => null)) as {
				user?: { handle: string | null; image: string | null; bio: string | null };
			} | null;
			if (!res.ok || !body?.user) {
				const error = readApiError(body, m.welcome_save_error());
				if (error.code === 'handle_taken') availability = 'taken';
				errorMessage = error.message;
				return false;
			}
			saved = { ...saved, handle: body.user.handle, image: body.user.image, bio: body.user.bio };
			window.dispatchEvent(new CustomEvent('kizuna:profile-updated', { detail: body.user }));
			return true;
		} catch {
			errorMessage = m.welcome_network_error();
			return false;
		} finally {
			saving = false;
		}
	}

	async function submitHandle(event: SubmitEvent) {
		event.preventDefault();
		if (availability !== 'available') return;
		if (candidate === saved.handle || (await saveProfile({ handle: candidate }))) await goTo(1);
	}

	async function submitProfile(event: SubmitEvent) {
		event.preventDefault();
		const image = avatarUrl || null;
		const trimmedBio = bio.trim() || null;
		const unchanged = image === saved.image && trimmedBio === saved.bio;
		if (unchanged || (await saveProfile({ image, bio: trimmedBio }))) await goTo(2);
	}

	async function toggleFollow(creator: PageData['suggestions'][number]) {
		try {
			await followStore.set(creator.id, followStore.status(creator.id) === 'none');
		} catch (err) {
			toast.show(err instanceof Error ? err.message : m.follow_error());
		}
	}

	async function finish() {
		saving = true;
		errorMessage = null;
		try {
			const res = await fetch('/api/account/onboarding', { method: 'POST' });
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				errorMessage = readApiError(body, m.welcome_finish_error()).message;
				saving = false;
				return;
			}
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- a same-origin path checked by the server
			await goto(data.redirectTo, { invalidateAll: true });
		} catch {
			errorMessage = m.welcome_network_error();
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>{m.welcome_title()}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main
	class="min-h-screen min-h-dvh flex flex-col justify-start sm:justify-center items-center pt-safe pb-safe px-0 sm:p-6 bg-white sm:bg-slate-50 dark:bg-dark-canvas transition-colors duration-200"
>
	<div
		class="w-full max-w-[32rem] mx-auto my-auto box-border px-4 py-6 sm:p-9 bg-transparent sm:bg-white dark:sm:bg-dark-card sm:rounded-3xl sm:border border-slate-100 dark:border-dark-border sm:shadow-[0_20px_45px_-12px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.03)] dark:sm:shadow-[0_12px_28px_0_rgba(0,0,0,0.35)]"
	>
		<KizunaLogo />

		<nav aria-label={m.welcome_progress()} class="mb-6">
			<p class="text-xs font-semibold text-slate-500 dark:text-dark-muted mb-2">
				{m.welcome_step(step + 1, STEPS.length)}
			</p>
			<ol class="grid grid-cols-4 gap-1.5 list-none p-0 m-0">
				{#each STEPS as { title }, index (title)}
					<li aria-current={index === step ? 'step' : undefined}>
						<span
							class="block h-1.5 rounded-full transition-colors duration-200 {index <= step
								? 'bg-slate-950 dark:bg-kizuna-blue'
								: 'bg-slate-200 dark:bg-dark-elevated'}"
							aria-hidden="true"
						></span>
						<span class="sr-only">
							{index < step ? m.welcome_step_done(title) : title}
						</span>
					</li>
				{/each}
			</ol>
		</nav>

		<h1
			bind:this={heading}
			tabindex="-1"
			class="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 dark:text-dark-text m-0 outline-none"
		>
			{STEPS[step].title}
		</h1>
		<p class="text-sm text-slate-500 dark:text-dark-muted mt-1 mb-5">
			{STEPS[step].description}
		</p>

		{#if errorMessage}
			<AuthAlert type="error">{errorMessage}</AuthAlert>
		{/if}

		{#if step === 0}
			<form onsubmit={submitHandle} class="flex flex-col gap-5" novalidate>
				<div class="flex flex-col gap-1.5">
					<label for="welcome-handle" class={labelClass}>{m.welcome_handle()}</label>
					<div class="relative flex items-center">
						<span
							class="absolute left-3.5 text-sm font-medium text-slate-400 dark:text-dark-muted pointer-events-none"
							aria-hidden="true">@</span
						>
						<input
							id="welcome-handle"
							name="handle"
							type="text"
							bind:value={handle}
							required
							maxlength="31"
							autocomplete="username"
							autocapitalize="off"
							spellcheck="false"
							aria-describedby="welcome-handle-status"
							aria-invalid={availability === 'invalid' || availability === 'taken'}
							class="{inputClass} pl-8"
						/>
					</div>
					<p
						id="welcome-handle-status"
						class="text-xs m-0 {availability === 'available'
							? 'text-emerald-700 dark:text-emerald-400'
							: availability === 'checking'
								? 'text-slate-500 dark:text-dark-muted'
								: 'text-red-600 dark:text-red-400'}"
						aria-live="polite"
					>
						{handleMessage}
					</p>
				</div>
				<Button
					type="submit"
					size="lg"
					fullWidth
					disabled={availability !== 'available'}
					loading={saving}
				>
					{m.welcome_continue()}
				</Button>
			</form>
		{:else if step === 1}
			<form onsubmit={submitProfile} class="flex flex-col gap-5" novalidate>
				<AvatarUpload bind:url={avatarUrl} bind:uploading name={data.user.name} />
				<div class="flex flex-col gap-1.5">
					<div class="flex items-center justify-between">
						<label for="welcome-bio" class={labelClass}>{m.welcome_bio()}</label>
						<span class="text-[11px] text-slate-400 dark:text-dark-muted font-mono">
							{bio.length} / {BIO_MAX}
						</span>
					</div>
					<textarea
						id="welcome-bio"
						name="bio"
						bind:value={bio}
						rows="3"
						maxlength={BIO_MAX}
						class="{inputClass} h-auto min-h-20 py-3 resize-y"></textarea>
				</div>
				<div class="flex items-center justify-between gap-3">
					<Button variant="ghost" disabled={saving} onclick={() => goTo(0)}
						>{m.welcome_back()}</Button
					>
					<div class="flex items-center gap-2">
						<Button variant="outline" disabled={saving || uploading} onclick={() => goTo(2)}>
							{m.welcome_skip()}
						</Button>
						<Button type="submit" disabled={uploading} loading={saving}
							>{m.welcome_continue()}</Button
						>
					</div>
				</div>
			</form>
		{:else if step === 2}
			<div class="flex flex-col gap-5">
				{#if data.suggestions.length > 0}
					<ul class="flex flex-col gap-3.5 list-none p-0 m-0">
						{#each data.suggestions as creator (creator.id)}
							{@const status = followStore.status(creator.id)}
							<li class="flex items-center justify-between gap-3">
								<div class="flex items-center gap-2.5 min-w-0">
									<Avatar src={creator.image ?? ''} name={creator.name} size="sm" />
									<div class="flex flex-col min-w-0">
										<span class="text-sm font-semibold text-slate-900 dark:text-dark-text truncate">
											{creator.name}
										</span>
										<span class="text-xs text-slate-500 dark:text-dark-muted truncate">
											{creator.handle}
										</span>
									</div>
								</div>
								<Button
									variant={status === 'none' ? 'primary' : 'outline'}
									size="sm"
									class="shrink-0"
									disabled={followStore.isPending(creator.id)}
									aria-pressed={status !== 'none'}
									aria-label={followActionLabel(status, creator.name)}
									onclick={() => toggleFollow(creator)}
								>
									{FOLLOW_LABELS[status]}
								</Button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-sm text-slate-500 dark:text-dark-muted m-0">
						{m.welcome_no_suggestions()}
					</p>
				{/if}
				<div class="flex items-center justify-between gap-3">
					<Button variant="ghost" onclick={() => goTo(1)}>{m.welcome_back()}</Button>
					<Button variant={followedAny ? 'primary' : 'outline'} onclick={() => goTo(3)}>
						{followedAny ? m.welcome_continue() : m.welcome_skip()}
					</Button>
				</div>
			</div>
		{:else}
			<div class="flex flex-col gap-5">
				<div class="flex items-center gap-3">
					<Avatar src={saved.image ?? ''} name={data.user.name} size="lg" />
					<div class="flex flex-col min-w-0">
						<span class="font-semibold text-slate-900 dark:text-dark-text truncate">
							{data.user.name}
						</span>
						<span class="text-sm text-slate-500 dark:text-dark-muted truncate">
							@{saved.handle}
						</span>
					</div>
				</div>
				<div class="flex items-center justify-between gap-3">
					<Button variant="ghost" disabled={saving} onclick={() => goTo(2)}
						>{m.welcome_back()}</Button
					>
					<Button size="lg" loading={saving} onclick={finish}>{m.welcome_start()}</Button>
				</div>
			</div>
		{/if}
	</div>
</main>
