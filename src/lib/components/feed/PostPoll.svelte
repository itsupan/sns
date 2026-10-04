<script lang="ts">
	import Icon from '$lib/components/shared/Icon.svelte';
	import { pollSummary, type PollData } from '$lib/polls';
	import { readApiError } from '$lib/utils/api-error';
	import { toast } from '$lib/utils/toast.svelte';
	import { m } from '$lib/i18n';

	interface Props {
		postId: string;
		poll: PollData;
		/** The post's author sees the results without voting. */
		isOwner: boolean;
		/** Resolves to whether the viewer is signed in, sending them to log in otherwise. */
		requireSignIn: (message: string) => Promise<boolean>;
	}

	let { postId, poll: pollProp, isOwner, requireSignIn }: Props = $props();

	let answered = $state<PollData | null>(null);
	let voting = $state(false);
	let poll = $derived(answered ?? pollProp);
	let showResults = $derived(Boolean(poll.votedOptionId) || poll.closed || isOwner);

	function percent(votes: number): number {
		return poll.totalVotes > 0 ? Math.round((votes / poll.totalVotes) * 100) : 0;
	}

	async function vote(optionId: string) {
		if (voting || !(await requireSignIn(m.poll_log_in_to_vote()))) return;
		voting = true;
		try {
			const res = await fetch(`/api/posts/${postId}/poll/vote`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ optionId })
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				const error = readApiError(body, m.poll_vote_error());
				if (error.code === 'poll_closed') answered = { ...poll, closed: true };
				toast.show(error.message);
				return;
			}
			answered = (body as { poll: PollData }).poll;
		} catch {
			toast.show(m.poll_vote_error());
		} finally {
			voting = false;
		}
	}
</script>

<div class="px-4 lg:px-0 mb-3 lg:mb-4 flex flex-col gap-2">
	{#if showResults}
		<ul class="m-0 p-0 list-none flex flex-col gap-2" aria-label={m.poll_results()}>
			{#each poll.options as option (option.id)}
				{@const share = percent(option.votes)}
				{@const mine = option.id === poll.votedOptionId}
				<li
					class="relative h-10 rounded-xl overflow-hidden bg-slate-50 dark:bg-dark-elevated/60 flex items-center justify-between gap-3 px-3 text-sm"
				>
					<span
						class="absolute inset-y-0 left-0 {mine
							? 'bg-blue-100 dark:bg-kizuna-blue/25'
							: 'bg-slate-200/70 dark:bg-dark-hover'}"
						style:width="{share}%"
						aria-hidden="true"
					></span>
					<span
						class="relative flex items-center gap-1.5 min-w-0 text-slate-900 dark:text-dark-text {mine
							? 'font-semibold'
							: ''}"
					>
						<span class="truncate">{option.label}</span>
						{#if mine}
							<Icon
								name="check-circle"
								class="text-sm shrink-0 text-blue-600 dark:text-kizuna-blue"
							/>
							<span class="sr-only">{m.poll_your_vote()}</span>
						{/if}
					</span>
					<span class="relative shrink-0 font-semibold text-slate-700 dark:text-dark-muted">
						{share}%
					</span>
				</li>
			{/each}
		</ul>
	{:else}
		<div class="flex flex-col gap-2" role="group" aria-label={m.poll_options()}>
			{#each poll.options as option (option.id)}
				<button
					type="button"
					class="h-10 px-3 rounded-xl border border-blue-600/40 dark:border-kizuna-blue/40 bg-transparent text-sm font-semibold text-blue-600 dark:text-kizuna-blue hover:bg-blue-50 dark:hover:bg-dark-hover cursor-pointer transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-default truncate"
					aria-label={m.poll_vote_for(option.label)}
					disabled={voting}
					onclick={() => vote(option.id)}
				>
					{option.label}
				</button>
			{/each}
		</div>
	{/if}
	<p class="m-0 text-xs text-slate-500 dark:text-dark-muted" aria-live="polite">
		{pollSummary(poll)}
	</p>
</div>
