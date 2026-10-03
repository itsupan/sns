<script lang="ts">
	import { onMount } from 'svelte';
	import { readApiError } from '$lib/utils/api-error';
	import { toast } from '$lib/utils/toast.svelte';
	import { m } from '$lib/i18n';
	import Switch from './Switch.svelte';
	import { hintClass, rowClass } from './styles';

	interface Props {
		/** VAPID public key (base64url) this device subscribes with. */
		publicKey: string;
	}

	let { publicKey }: Props = $props();

	const ENDPOINT = '/api/push/subscriptions';

	let status = $state<'loading' | 'unsupported' | 'denied' | 'off' | 'on'>('loading');
	let saving = $state(false);
	const hint = $derived(
		status === 'unsupported'
			? m.settings_push_unsupported()
			: status === 'denied'
				? m.settings_push_denied()
				: null
	);

	function supported(): boolean {
		return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
	}

	onMount(async () => {
		if (!supported()) {
			status = 'unsupported';
			return;
		}
		if (Notification.permission === 'denied') {
			status = 'denied';
			return;
		}
		const registration = await navigator.serviceWorker.getRegistration();
		status = (await registration?.pushManager.getSubscription()) ? 'on' : 'off';
	});

	function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
		return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (c) =>
			c.charCodeAt(0)
		);
	}

	/** Tells the server; returns the error to show, or null once saved. */
	async function sync(method: 'POST' | 'DELETE', body: unknown): Promise<string | null> {
		const res = await fetch(ENDPOINT, {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (res.ok) return null;
		return readApiError(await res.json().catch(() => null), m.settings_push_error()).message;
	}

	async function subscribe(registration: ServiceWorkerRegistration) {
		const permission = await Notification.requestPermission();
		if (permission !== 'granted') {
			if (permission === 'denied') status = 'denied';
			return;
		}
		const subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: base64UrlToBytes(publicKey)
		});
		const error = await sync('POST', subscription.toJSON());
		if (error) {
			await subscription.unsubscribe();
			toast.error(error);
			return;
		}
		status = 'on';
	}

	async function unsubscribe(registration: ServiceWorkerRegistration) {
		const subscription = await registration.pushManager.getSubscription();
		if (subscription) {
			const error = await sync('DELETE', { endpoint: subscription.endpoint });
			if (error) {
				toast.error(error);
				return;
			}
			await subscription.unsubscribe();
		}
		status = 'off';
	}

	async function toggle() {
		saving = true;
		try {
			const registration = await navigator.serviceWorker.ready;
			await (status === 'on' ? unsubscribe(registration) : subscribe(registration));
		} catch {
			toast.error(m.settings_push_error());
		} finally {
			saving = false;
		}
	}
</script>

<div class={rowClass}>
	<span class="flex flex-col min-w-0">
		<span id="push-notifications-label">{m.settings_push_label()}</span>
		{#if hint}
			<span id="push-notifications-hint" class={hintClass}>{hint}</span>
		{/if}
	</span>
	<Switch
		checked={status === 'on'}
		disabled={saving || (status !== 'on' && status !== 'off')}
		labelledby="push-notifications-label"
		describedby={hint ? 'push-notifications-hint' : undefined}
		onclick={toggle}
	/>
</div>
