/**
 * Backgrounds for text posts. The post stores the key; the classes live here so Tailwind sees
 * them and a stored value can never inject arbitrary CSS.
 */
export const TEXT_BACKGROUNDS = {
	sunset: 'bg-linear-to-br from-orange-500 to-rose-600',
	ocean: 'bg-linear-to-br from-sky-500 to-blue-700',
	forest: 'bg-linear-to-br from-emerald-500 to-teal-700',
	grape: 'bg-linear-to-br from-fuchsia-600 to-purple-700',
	candy: 'bg-linear-to-br from-pink-500 to-violet-600',
	midnight: 'bg-linear-to-br from-slate-700 to-slate-950'
} as const;

export type TextBackground = keyof typeof TEXT_BACKGROUNDS;

export const TEXT_BACKGROUND_KEYS = Object.keys(TEXT_BACKGROUNDS) as TextBackground[];

export const DEFAULT_TEXT_BACKGROUND: TextBackground = 'sunset';

export function isTextBackground(value: unknown): value is TextBackground {
	return typeof value === 'string' && Object.hasOwn(TEXT_BACKGROUNDS, value);
}
