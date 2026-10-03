<script lang="ts">
	import BottomSheet from '$lib/components/shared/BottomSheet.svelte';
	import { MODERATION_NOTE_MAX, SUSPENSION_OPTIONS, type ResolveAction } from '$lib/moderation';
	import { readApiError } from '$lib/utils/api-error';
	import { toast } from '$lib/utils/toast.svelte';

	interface Props {
		open?: boolean;
		action: ResolveAction;
		targetType: 'post' | 'comment' | 'user' | 'message';
		targetId: string;
		/** Display name of the user who owns the target. */
		ownerName: string | null;
		onresolved: () => void;
	}

	let {
		open = $bindable(false),
		action,
		targetType,
		targetId,
		ownerName,
		onresolved
	}: Props = $props();
	const uid = $props.id();
	const formId = `resolve-${uid}`;

	const NOUN = { post: 'post', comment: 'comment', user: 'account', message: 'message' };
	const TITLE: Record<ResolveAction, string> = {
		dismiss: 'Dismiss reports',
		remove_content: 'Remove content',
		suspend_user: 'Suspend user'
	};
	const CONFIRM: Record<ResolveAction, string> = {
		dismiss: 'Dismiss',
		remove_content: 'Remove',
		suspend_user: 'Suspend'
	};

	let days = $state<number | null>(7);
	let note = $state('');
	let submitting = $state(false);
	let error = $state<string | null>(null);

	let description = $derived(
		{
			dismiss: `Close every open report on this ${NOUN[targetType]} and leave it up.`,
			remove_content: `Remove this ${NOUN[targetType]} and close every open report on it.`,
			suspend_user: `Sign ${ownerName ?? 'this user'} out and block them from signing in.`
		}[action]
	);

	function reset() {
		days = 7;
		note = '';
		error = null;
	}

	async function submit() {
		if (submitting) return;
		submitting = true;
		error = null;
		try {
			const res = await fetch('/api/admin/reports/resolve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					targetType,
					targetId,
					action,
					durationDays: action === 'suspend_user' ? days : undefined,
					note: note.trim() || undefined
				})
			});
			if (!res.ok) {
				error = readApiError(await res.json().catch(() => null), 'Could not resolve').message;
				return;
			}
			open = false;
			reset();
			toast.success('Resolved');
			onresolved();
		} catch {
			error = 'Could not resolve';
		} finally {
			submitting = false;
		}
	}
</script>

<BottomSheet bind:open title={TITLE[action]} showTitle onclose={reset}>
	<form
		id={formId}
		class="flex flex-col gap-3 px-2"
		onsubmit={(e) => {
			e.preventDefault();
			submit();
		}}
	>
		<p class="m-0 text-sm text-slate-600 dark:text-dark-muted">{description}</p>

		{#if action === 'suspend_user'}
			<label class="flex flex-col gap-1.5">
				<span class="text-sm font-medium text-slate-700 dark:text-dark-text">Duration</span>
				<select
					bind:value={days}
					class="h-10 px-3 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated text-sm text-slate-900 dark:text-dark-text"
				>
					{#each SUSPENSION_OPTIONS as option (option.label)}
						<option value={option.days}>{option.label}</option>
					{/each}
				</select>
			</label>
		{/if}

		<label class="flex flex-col gap-1.5">
			<span class="text-sm font-medium text-slate-700 dark:text-dark-text">
				Note <span class="font-normal text-slate-400">(optional, kept in the audit log)</span>
			</span>
			<textarea
				bind:value={note}
				maxlength={MODERATION_NOTE_MAX}
				rows="2"
				class="w-full resize-none rounded-2xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated px-3 py-2 text-sm text-slate-900 dark:text-dark-text outline-none focus:border-slate-400"
			></textarea>
		</label>

		{#if error}
			<p role="alert" class="m-0 text-sm text-red-600 dark:text-red-400">{error}</p>
		{/if}
	</form>

	{#snippet footer()}
		<div class="flex justify-end gap-2">
			<button
				type="button"
				class="h-10 px-4 rounded-full text-sm font-semibold bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text border-0 cursor-pointer hover:bg-slate-200 dark:hover:bg-dark-hover"
				onclick={() => {
					open = false;
					reset();
				}}
			>
				Cancel
			</button>
			<button
				type="submit"
				form={formId}
				class="h-10 px-5 rounded-full text-sm font-semibold border-0 cursor-pointer disabled:opacity-50 disabled:cursor-default {action ===
				'dismiss'
					? 'bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950'
					: 'bg-red-600 text-white hover:bg-red-700'}"
				disabled={submitting}
			>
				{submitting ? 'Working…' : CONFIRM[action]}
			</button>
		</div>
	{/snippet}
</BottomSheet>
