<script lang="ts">
	import { m } from '$lib/i18n';
	import Avatar from './Avatar.svelte';
	import { insertMention, mentionAt } from '$lib/formatting-editor';

	interface Suggestion {
		id: string;
		name: string;
		handle: string;
		image: string | null;
	}

	interface Props {
		/** The textarea where `@` opens suggestions. */
		target: HTMLTextAreaElement | null;
	}

	let { target }: Props = $props();

	const DEBOUNCE_MS = 150;

	let mention = $state<{ start: number; query: string } | null>(null);
	let users = $state<Suggestion[]>([]);
	let active = $state(0);
	let open = $derived(mention !== null && users.length > 0);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let latest = 0;

	$effect(() => {
		const node = target;
		if (!node) return;
		const onInput = () => update(node);
		const onBlur = () => close();
		const onKeydown = (e: KeyboardEvent) => {
			// Keys that finish an IME composition belong to the input method, not the list.
			if (!open || e.isComposing) return;
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				e.preventDefault();
				const step = e.key === 'ArrowDown' ? 1 : -1;
				active = (active + step + users.length) % users.length;
			} else if (e.key === 'Enter' || e.key === 'Tab') {
				e.preventDefault();
				choose(users[active]);
			} else if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				close();
			}
		};
		node.addEventListener('input', onInput);
		node.addEventListener('click', onInput);
		node.addEventListener('blur', onBlur);
		node.addEventListener('keydown', onKeydown);
		return () => {
			node.removeEventListener('input', onInput);
			node.removeEventListener('click', onInput);
			node.removeEventListener('blur', onBlur);
			node.removeEventListener('keydown', onKeydown);
			clearTimeout(timer);
		};
	});

	function update(node: HTMLTextAreaElement) {
		mention = mentionAt(node.value, node.selectionStart);
		clearTimeout(timer);
		if (!mention) {
			users = [];
			return;
		}
		const query = mention.query;
		timer = setTimeout(() => load(query), DEBOUNCE_MS);
	}

	async function load(query: string) {
		const request = ++latest;
		try {
			const res = await fetch(`/api/users/suggest?q=${encodeURIComponent(query)}`);
			const body = (await res.json().catch(() => null)) as { users?: Suggestion[] } | null;
			if (request !== latest) return;
			users = res.ok ? (body?.users ?? []) : [];
			active = 0;
		} catch {
			if (request === latest) users = [];
		}
	}

	function close() {
		clearTimeout(timer);
		latest += 1;
		mention = null;
		users = [];
	}

	function choose(user: Suggestion) {
		const node = target;
		if (!node || !mention) return;
		const r = insertMention(node.value, mention.start, node.selectionStart, user.handle);
		if (node.maxLength > 0 && r.value.length > node.maxLength) return close();
		node.value = r.value;
		node.focus();
		node.setSelectionRange(r.start, r.end);
		// Let bindings (and autogrow) see the change; it also closes the list.
		node.dispatchEvent(new Event('input', { bubbles: true }));
	}
</script>

{#if open}
	<ul
		class="list-none m-0 p-1 rounded-2xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card shadow-lg"
		aria-label={m.composer_people_to_tag()}
	>
		{#each users as user, i (user.id)}
			<li>
				<button
					type="button"
					class="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl border-0 cursor-pointer text-left {i ===
					active
						? 'bg-slate-100 dark:bg-dark-elevated'
						: 'bg-transparent hover:bg-slate-50 dark:hover:bg-dark-hover'}"
					aria-current={i === active}
					onmousedown={(e) => e.preventDefault()}
					onclick={() => choose(user)}
				>
					<Avatar src={user.image} name={user.name} size="sm" />
					<span class="flex flex-col min-w-0 leading-tight">
						<span class="text-sm font-semibold text-slate-900 dark:text-dark-text truncate">
							{user.name}
						</span>
						<span class="text-xs text-slate-500 dark:text-dark-muted truncate">@{user.handle}</span>
					</span>
				</button>
			</li>
		{/each}
	</ul>
{/if}
