import { vi } from 'vitest';

/**
 * Reports every observed element as in view as soon as it is observed, so infinite-scroll lists
 * load their next page without depending on the test viewport. Undo with `vi.unstubAllGlobals()`.
 */
export function stubIntersectionObserver() {
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			constructor(private cb: IntersectionObserverCallback) {}
			observe(target: Element) {
				queueMicrotask(() =>
					this.cb(
						[{ isIntersecting: true, target } as IntersectionObserverEntry],
						this as unknown as IntersectionObserver
					)
				);
			}
			disconnect() {}
			unobserve() {}
		}
	);
}
