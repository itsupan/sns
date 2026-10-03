<script lang="ts" module>
	interface TurnstileApi {
		render(
			container: HTMLElement,
			options: {
				sitekey: string;
				size: 'flexible';
				callback: (token: string) => void;
				'expired-callback': () => void;
				'error-callback': () => void;
			}
		): string;
		reset(widgetId: string): void;
		remove(widgetId: string): void;
	}

	const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

	let scriptLoad: Promise<TurnstileApi> | undefined;

	/** Adds Cloudflare's script on first use; later widgets reuse it, a failed load is retried. */
	function loadTurnstile(): Promise<TurnstileApi> {
		scriptLoad ??= new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.src = SCRIPT_URL;
			script.async = true;
			script.onload = () => {
				const api = (window as Window & { turnstile?: TurnstileApi }).turnstile;
				if (api) resolve(api);
				else reject(new Error('Turnstile did not load'));
			};
			script.onerror = () => {
				script.remove();
				scriptLoad = undefined;
				reject(new Error('Turnstile did not load'));
			};
			document.head.appendChild(script);
		});
		return scriptLoad;
	}
</script>

<script lang="ts">
	import { page } from '$app/state';

	interface Props {
		/** The solved challenge, sent as `x-captcha-response`; empty until solved and after expiry. */
		token: string;
	}

	// eslint-disable-next-line no-useless-assignment -- `token` is bindable: the form reads every write
	let { token = $bindable() }: Props = $props();

	let api: TurnstileApi | undefined;
	let widgetId: string | undefined;
	let failed = $state(false);

	/** A token is good for one request, so the form asks for a fresh one after each submit. */
	export function reset() {
		token = '';
		if (api && widgetId) api.reset(widgetId);
	}

	function widget(sitekey: string) {
		return (container: HTMLElement) => {
			let removed = false;
			loadTurnstile().then(
				(turnstile) => {
					if (removed) return;
					api = turnstile;
					widgetId = turnstile.render(container, {
						sitekey,
						size: 'flexible',
						callback: (value) => (token = value),
						'expired-callback': () => (token = ''),
						'error-callback': () => (token = '')
					});
				},
				() => (failed = true)
			);
			return () => {
				removed = true;
				if (api && widgetId) api.remove(widgetId);
				widgetId = undefined;
				token = '';
			};
		};
	}
</script>

{#if page.data.turnstileSiteKey}
	<div {@attach widget(page.data.turnstileSiteKey)}></div>
	{#if failed}
		<p class="m-0 text-[13px] text-red-700 dark:text-red-300" role="alert">
			The security check could not load. Check your connection and reload the page.
		</p>
	{/if}
{/if}
