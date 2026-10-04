<script lang="ts">
	import { m } from '$lib/i18n';

	interface Props {
		/** The page being shared. */
		url: string;
		/** Message that goes with the link, where the platform takes one. */
		text: string;
		onshare?: () => void;
	}

	let { url, text, onshare }: Props = $props();

	let platforms = $derived.by(() => {
		const u = encodeURIComponent(url);
		const t = encodeURIComponent(text);
		return [
			{
				name: 'Telegram',
				href: `https://t.me/share/url?url=${u}&text=${t}`,
				color: 'bg-[#229ED9] text-white',
				icon: 'size-6',
				path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z'
			},
			{
				name: 'Facebook',
				href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
				color: 'bg-[#1877F2] text-white',
				icon: 'size-6',
				path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z'
			},
			{
				name: 'WhatsApp',
				href: `https://api.whatsapp.com/send?text=${t}%20${u}`,
				color: 'bg-[#25D366] text-white',
				icon: 'size-6',
				path: 'M17.472 14.382c-.301-.15-1.782-.879-2.058-.979-.276-.1-.476-.15-.677.15-.2.301-.776.979-.952 1.18-.175.201-.351.226-.652.075-.301-.15-1.272-.469-2.424-1.496-.895-.798-1.5-1.784-1.675-2.085-.176-.301-.019-.464.132-.614.135-.135.301-.351.451-.527.151-.176.201-.301.301-.502.101-.2.05-.376-.025-.527-.075-.15-.677-1.632-.928-2.234-.244-.588-.493-.508-.677-.517l-.578-.01c-.2 0-.527.075-.803.376s-1.054 1.029-1.054 2.509c0 1.48 1.079 2.909 1.229 3.11.15.201 2.124 3.243 5.146 4.549.719.311 1.28.497 1.718.636.722.23 1.378.197 1.898.12.579-.087 1.782-.728 2.033-1.431.251-.703.251-1.306.176-1.431-.076-.126-.276-.201-.577-.352zM12.04 2C6.51 2 2.02 6.49 2.02 12.02c0 1.954.56 3.864 1.62 5.517L2 22l4.636-1.587a10.02 10.02 0 005.404 1.587c5.53 0 10.02-4.49 10.02-10.02C22.06 6.49 17.57 2 12.04 2z'
			},
			{
				name: 'X',
				href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
				color: 'bg-black text-white dark:bg-white dark:text-black',
				icon: 'size-5',
				path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'
			}
		];
	});
</script>

<div class="flex flex-col gap-2">
	<span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-dark-muted">
		{m.share_via()}
	</span>
	<div class="grid grid-cols-4 gap-2.5 pt-1">
		<!-- eslint-disable svelte/no-navigation-without-resolve -- external share URLs -->
		{#each platforms as platform (platform.name)}
			<a
				href={platform.href}
				target="_blank"
				rel="noopener noreferrer"
				onclick={onshare}
				class="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-dark-elevated text-slate-700 dark:text-dark-text transition-all no-underline group active:scale-95"
			>
				<div
					class="size-12 rounded-2xl {platform.color} flex items-center justify-center shadow-xs transition-transform group-hover:scale-105"
				>
					<svg class="{platform.icon} fill-current" viewBox="0 0 24 24" aria-hidden="true">
						<path d={platform.path} />
					</svg>
				</div>
				<span class="text-[11px] font-medium text-slate-700 dark:text-dark-text">
					{platform.name}
				</span>
			</a>
		{/each}
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</div>
</div>
