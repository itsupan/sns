/** Reactive stand-in for `$app/state`'s `navigating`: tests set `to` to start or end a navigation. */
export const navigating = $state<{ to: { url: URL } | null }>({ to: null });
