<script lang="ts" module>
	import { m } from '$lib/i18n';

	export type ReportTargetType = 'post' | 'comment' | 'user' | 'message';

	/** Same values as `REPORT_REASONS` in the server schema. */
	export const REPORT_REASON_OPTIONS = [
		{ value: 'spam', label: m.report_reason_spam() },
		{ value: 'harassment', label: m.report_reason_harassment() },
		{ value: 'hate', label: m.report_reason_hate() },
		{ value: 'nudity', label: m.report_reason_nudity() },
		{ value: 'violence', label: m.report_reason_violence() },
		{ value: 'self_harm', label: m.report_reason_self_harm() },
		{ value: 'copyright', label: m.report_reason_copyright() },
		{ value: 'impersonation', label: m.report_reason_impersonation() },
		{ value: 'other', label: m.report_reason_other() }
	] as const;

	export type ReportReasonValue = (typeof REPORT_REASON_OPTIONS)[number]['value'];

	/** Same as `REPORT_DETAILS_MAX` on the server. */
	export const REPORT_DETAILS_MAX = 500;
</script>

<script lang="ts">
	import BottomSheet from './BottomSheet.svelte';
	import { toast } from '$lib/utils/toast.svelte';
	import { readApiError } from '$lib/utils/api-error';

	interface Props {
		open?: boolean;
		targetType: ReportTargetType;
		targetId: string;
		onreported?: () => void;
	}

	let { open = $bindable(false), targetType, targetId, onreported }: Props = $props();
	const uid = $props.id();
	const formId = `report-${uid}`;

	const NOUN: Record<ReportTargetType, string> = {
		post: m.report_target_post(),
		comment: m.report_target_comment(),
		user: m.report_target_user(),
		message: m.report_target_message()
	};

	let reason = $state<ReportReasonValue | null>(null);
	let details = $state('');
	let submitting = $state(false);
	let error = $state<string | null>(null);

	function reset() {
		reason = null;
		details = '';
		error = null;
	}

	async function submit() {
		if (!reason || submitting) return;
		submitting = true;
		error = null;
		try {
			const res = await fetch('/api/reports', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					targetType,
					targetId,
					reason,
					details: details.trim() || undefined
				})
			});
			if (!res.ok) {
				const data = await res.json().catch(() => null);
				error = readApiError(data, m.report_error()).message;
				return;
			}
			open = false;
			reset();
			toast.success(m.report_sent());
			onreported?.();
		} catch {
			error = m.report_error();
		} finally {
			submitting = false;
		}
	}
</script>

<BottomSheet bind:open title={m.report_title(NOUN[targetType])} showTitle onclose={reset}>
	<form
		id={formId}
		class="flex flex-col gap-1 px-2"
		onsubmit={(e) => {
			e.preventDefault();
			submit();
		}}
	>
		<fieldset class="flex flex-col border-0 p-0 m-0">
			<legend class="px-2 pb-2 text-sm text-slate-600 dark:text-dark-muted">
				{m.report_why(NOUN[targetType])}
			</legend>
			{#each REPORT_REASON_OPTIONS as option (option.value)}
				<label
					class="flex items-center gap-3 min-h-11 px-2 rounded-xl text-[15px] text-slate-900 dark:text-dark-text cursor-pointer hover:bg-slate-50 dark:hover:bg-dark-elevated"
				>
					<input
						type="radio"
						name="{formId}-reason"
						value={option.value}
						bind:group={reason}
						class="size-4 accent-slate-900 dark:accent-white"
					/>
					<span>{option.label}</span>
				</label>
			{/each}
		</fieldset>

		<label class="flex flex-col gap-1.5 px-2 pt-2">
			<span class="text-sm font-medium text-slate-700 dark:text-dark-text">
				{m.report_details()} <span class="font-normal text-slate-400">{m.common_optional()}</span>
			</span>
			<textarea
				bind:value={details}
				maxlength={REPORT_DETAILS_MAX}
				rows="3"
				placeholder={m.report_details_placeholder()}
				class="w-full resize-none rounded-2xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated px-3 py-2 text-sm text-slate-900 dark:text-dark-text outline-none focus:border-slate-400"
			></textarea>
			<span class="self-end text-xs text-slate-400">{details.length}/{REPORT_DETAILS_MAX}</span>
		</label>

		{#if error}
			<p role="alert" class="px-2 text-sm text-red-600 dark:text-red-400">{error}</p>
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
				{m.common_cancel()}
			</button>
			<button
				type="submit"
				form={formId}
				class="h-10 px-5 rounded-full text-sm font-semibold bg-red-600 text-white border-0 cursor-pointer hover:bg-red-700 disabled:opacity-50 disabled:cursor-default"
				disabled={!reason || submitting}
			>
				{submitting ? m.common_sending() : m.report_submit()}
			</button>
		</div>
	{/snippet}
</BottomSheet>
