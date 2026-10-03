/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />
import { base, build, version } from '$service-worker';
import type { PushPayload } from '$lib/push';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `kizuna-${version}`;
const OFFLINE_PAGE = `${base}/offline`;

/** Build output: content-hashed, so a cached copy never goes stale. */
const IMMUTABLE = new Set(build);

const NOTIFICATION_ICON = `${base}/brand/icon-192.png`;

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([...build, OFFLINE_PAGE])));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
			)
	);
});

async function cacheFirst(request: Request): Promise<Response> {
	return (await caches.match(request, { cacheName: CACHE })) ?? fetch(request);
}

/** Pages always come from the network, so nothing personal is cached; offline gets the fallback. */
async function networkFirst(request: Request): Promise<Response> {
	try {
		return await fetch(request);
	} catch (err) {
		const offline = await caches.match(OFFLINE_PAGE, { cacheName: CACHE });
		if (offline) return offline;
		throw err;
	}
}

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	// The API (media and auth included) is never cached or answered from here.
	if (
		request.method !== 'GET' ||
		url.origin !== sw.location.origin ||
		url.pathname.startsWith(`${base}/api/`)
	) {
		return;
	}
	if (IMMUTABLE.has(url.pathname)) event.respondWith(cacheFirst(request));
	else if (request.mode === 'navigate') event.respondWith(networkFirst(request));
});

sw.addEventListener('push', (event) => {
	const payload = event.data?.json() as PushPayload | undefined;
	if (!payload) return;
	event.waitUntil(
		sw.registration.showNotification(payload.title, {
			body: payload.body,
			icon: NOTIFICATION_ICON,
			tag: payload.tag,
			data: { url: payload.url }
		})
	);
});

/** Focuses a tab already showing `url`, else the app's first tab moved there, else a new one. */
async function openUrl(url: string): Promise<void> {
	const tabs = await sw.clients.matchAll({ type: 'window' });
	const tab = tabs.find((t) => t.url === url) ?? tabs[0];
	if (!tab) {
		await sw.clients.openWindow(url);
		return;
	}
	const focused = await tab.focus();
	if (focused.url !== url) await focused.navigate(url);
}

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = new URL(event.notification.data?.url ?? `${base}/`, sw.location.origin);
	// Only ever open our own pages.
	const url = target.origin === sw.location.origin ? target.href : sw.location.origin;
	event.waitUntil(openUrl(url));
});
