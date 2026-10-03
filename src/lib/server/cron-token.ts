const KEY = Symbol.for('kizuna.cronToken');

/**
 * Secret that lets the `scheduled` handler in worker.ts run cron routes through the app's own
 * `fetch`. worker.ts and the SvelteKit bundle each load their own copy of this module, so the
 * token lives on `globalThis`: random per isolate and never sent outside it.
 */
export function cronToken(): string {
	const holder = globalThis as { [KEY]?: string };
	return (holder[KEY] ??= crypto.randomUUID());
}
