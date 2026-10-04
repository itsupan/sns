<script lang="ts" module>
	export interface SearchUser {
		id: string;
		name: string;
		handle: string;
		slug: string;
		image: string | null;
		bio: string | null;
		followersCount: number;
	}

	export interface SearchPost {
		id: string;
		snippet: string;
		location: string | null;
		thumbnail: { url: string; type: 'image' | 'video'; alt?: string } | null;
		author: { id: string; name: string; handle: string; image: string | null };
	}

	/** Wait after the last keystroke before searching. */
	export const SEARCH_DEBOUNCE_MS = 300;
</script>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';
	import { readApiError } from '$lib/utils/api-error';
	import { MIN_TERM_LENGTH, highlightSegments, searchTermsOf } from '$lib/search';

	interface Props {
		/** Focus the input when its dialog opens (mobile search screen). */
		autofocus?: boolean;
		/** Called after navigating to a result, e.g. to close the mobile screen. */
		onNavigate?: () => void;
		class?: string;
	}

	let { autofocus = false, onNavigate, class: className = '' }: Props = $props();

	const uid = $props.id();
	const listboxId = `${uid}-listbox`;

	let query = $state('');
	let users = $state<SearchUser[]>([]);
	let posts = $state<SearchPost[]>([]);
	let status = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
	let errorMessage = $state('');
	/** Dropdown visibility; closed by Escape, blur or navigation. */
	let expanded = $state(false);
	let activeIndex = $state(-1);
	let input = $state<HTMLInputElement | null>(null);

	let terms = $derived(searchTermsOf(query));
	let searchable = $derived(terms.length > 0);
	/** Users then posts, in display order, for keyboard navigation. */
	let options = $derived([
		...users.map((u) => ({
			id: `${uid}-user-${u.id}`,
			href: resolve('/profile/[id]', { id: u.slug })
		})),
		...posts.map((p) => ({ id: `${uid}-post-${p.id}`, href: resolve('/post/[id]', { id: p.id }) }))
	]);
	let showDropdown = $derived(expanded && query.trim().length > 0);

	// Typing before hydration fires no handlers; open for whatever is already focused and typed.
	$effect(() => {
		if (input && document.activeElement === input) expanded = true;
	});

	// Debounced search: each keystroke restarts the timer and aborts the request in flight,
	// so a slow stale response can never replace newer results.
	$effect(() => {
		const q = query;
		if (!searchable) {
			users = [];
			posts = [];
			status = 'idle';
			return;
		}
		const controller = new AbortController();
		// Loading from the first keystroke, so stale "No results" never shows while typing.
		status = 'loading';
		const timer = setTimeout(async () => {
			try {
				const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
					signal: controller.signal
				});
				const data = await res.json().catch(() => null);
				// A superseded request must never touch state, even if it resolved anyway.
				if (controller.signal.aborted) return;
				if (!res.ok) throw new Error(readApiError(data, 'Search failed').message);
				const result = data as { users: SearchUser[]; posts: SearchPost[] };
				users = result.users;
				posts = result.posts;
				activeIndex = -1;
				status = 'done';
			} catch (err) {
				if (controller.signal.aborted) return;
				errorMessage = err instanceof Error ? err.message : 'Search failed';
				status = 'error';
			}
		}, SEARCH_DEBOUNCE_MS);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	function onInput() {
		expanded = true;
	}

	async function open(href: string) {
		expanded = false;
		activeIndex = -1;
		input?.blur();
		onNavigate?.();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- href comes from resolve()
		await goto(href);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (showDropdown) {
				e.preventDefault();
				e.stopPropagation();
				expanded = false;
				activeIndex = -1;
			}
			return;
		}
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			if (options.length === 0) return;
			e.preventDefault();
			expanded = true;
			const step = e.key === 'ArrowDown' ? 1 : -1;
			activeIndex = (activeIndex + step + options.length) % options.length;
			document.getElementById(options[activeIndex].id)?.scrollIntoView({ block: 'nearest' });
			return;
		}
		if (e.key === 'Enter') {
			const target = options[activeIndex] ?? (options.length === 1 ? options[0] : undefined);
			if (target) {
				e.preventDefault();
				open(target.href);
			}
		}
	}

	function onFocusOut(e: FocusEvent) {
		const container = e.currentTarget as HTMLElement;
		if (!container.contains(e.relatedTarget as Node | null)) {
			expanded = false;
			activeIndex = -1;
		}
	}

	const optionIndex = (id: string) => options.findIndex((o) => o.id === id);
</script>

{#snippet highlighted(text: string)}
	{#each highlightSegments(text, terms) as segment, i (i)}
		{#if segment.hit}<mark class="bg-amber-100 dark:bg-amber-400/25 text-inherit rounded-sm px-px"
				>{segment.text}</mark
			>{:else}{segment.text}{/if}
	{/each}
{/snippet}

<div class="relative w-full {className}" onfocusout={onFocusOut}>
	<div class="relative flex items-center w-full">
		<Icon
			name="search"
			class="absolute left-3.5 text-slate-500 dark:text-dark-subtle text-sm pointer-events-none"
		/>
		<!-- svelte-ignore a11y_autofocus (set only inside the mobile search dialog, which focuses it) -->
		<input
			bind:this={input}
			bind:value={query}
			{autofocus}
			oninput={onInput}
			onfocus={() => (expanded = true)}
			onkeydown={onKeydown}
			type="search"
			role="combobox"
			autocomplete="off"
			spellcheck="false"
			maxlength={200}
			aria-autocomplete="list"
			aria-expanded={showDropdown}
			aria-controls={listboxId}
			aria-activedescendant={activeIndex >= 0 ? options[activeIndex]?.id : undefined}
			placeholder="Search creators and posts…"
			aria-label="Search creators and posts"
			class="w-full h-10 pl-10 pr-4 text-sm bg-slate-100/85 dark:bg-dark-elevated text-slate-900 dark:text-dark-text placeholder:text-slate-500 dark:placeholder:text-dark-subtle rounded-full border-0 focus:outline-none focus:ring-1.5 focus:ring-slate-900 dark:focus:ring-white transition-all duration-150"
		/>
		{#if status === 'loading'}
			<span
				class="absolute right-3.5 size-4 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin"
				aria-hidden="true"
			></span>
		{/if}
	</div>

	<div
		id={listboxId}
		role="listbox"
		aria-label="Search results"
		hidden={!showDropdown}
		class="absolute left-0 right-0 top-full mt-2 z-50 max-h-[70vh] overflow-y-auto rounded-2xl bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border shadow-xl py-2"
	>
		{#if !searchable}
			<p class="px-4 py-3 text-xs text-slate-500 dark:text-dark-muted m-0" role="presentation">
				Type at least {MIN_TERM_LENGTH} characters to search.
			</p>
		{:else if status === 'error'}
			<p class="px-4 py-3 text-xs text-rose-600 m-0" role="presentation">{errorMessage}</p>
		{:else if status === 'done' && users.length === 0 && posts.length === 0}
			<p class="px-4 py-3 text-xs text-slate-500 dark:text-dark-muted m-0" role="presentation">
				No results for “{query.trim()}”.
			</p>
		{/if}

		{#if users.length > 0}
			<div role="group" aria-labelledby="{uid}-users-heading">
				<p
					id="{uid}-users-heading"
					class="px-4 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 m-0"
					role="presentation"
				>
					Users
				</p>
				{#each users as u (u.id)}
					{@const id = `${uid}-user-${u.id}`}
					<div
						{id}
						role="option"
						tabindex="-1"
						aria-selected={optionIndex(id) === activeIndex}
						onmousedown={(e) => e.preventDefault()}
						onclick={() => open(resolve('/profile/[id]', { id: u.slug }))}
						onkeydown={() => {}}
						onmousemove={() => (activeIndex = optionIndex(id))}
						class="flex items-center gap-3 px-4 py-2 cursor-pointer {optionIndex(id) === activeIndex
							? 'bg-slate-100 dark:bg-dark-elevated'
							: ''}"
					>
						<Avatar src={u.image ?? ''} name={u.name} size="sm" />
						<div class="min-w-0">
							<p class="text-sm font-semibold text-slate-900 dark:text-dark-text truncate m-0">
								{@render highlighted(u.name)}
							</p>
							<p class="text-xs text-slate-500 dark:text-dark-muted truncate m-0">
								{@render highlighted(u.handle)}
							</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if posts.length > 0}
			<div role="group" aria-labelledby="{uid}-posts-heading">
				<p
					id="{uid}-posts-heading"
					class="px-4 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 m-0"
					role="presentation"
				>
					Posts
				</p>
				{#each posts as p (p.id)}
					{@const id = `${uid}-post-${p.id}`}
					<div
						{id}
						role="option"
						tabindex="-1"
						aria-selected={optionIndex(id) === activeIndex}
						onmousedown={(e) => e.preventDefault()}
						onclick={() => open(resolve('/post/[id]', { id: p.id }))}
						onkeydown={() => {}}
						onmousemove={() => (activeIndex = optionIndex(id))}
						class="flex items-center gap-3 px-4 py-2 cursor-pointer {optionIndex(id) === activeIndex
							? 'bg-slate-100 dark:bg-dark-elevated'
							: ''}"
					>
						{#if p.thumbnail?.type === 'image'}
							<img
								src={p.thumbnail.url}
								alt={p.thumbnail.alt ?? ''}
								class="size-10 rounded-lg object-cover shrink-0 bg-slate-100"
								loading="lazy"
							/>
						{:else}
							<span
								class="size-10 rounded-lg shrink-0 bg-slate-100 dark:bg-dark-elevated flex items-center justify-center text-slate-400"
							>
								<Icon name={p.thumbnail ? 'play' : 'document'} class="text-sm" />
							</span>
						{/if}
						<div class="min-w-0">
							<p class="text-xs text-slate-800 dark:text-dark-text line-clamp-2 m-0">
								{@render highlighted(p.snippet)}
							</p>
							<p class="text-[11px] text-slate-500 dark:text-dark-muted truncate m-0 mt-0.5">
								{p.author.name}{#if p.location}
									· {@render highlighted(p.location)}{/if}
							</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
