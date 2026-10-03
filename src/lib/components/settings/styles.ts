/** Tailwind classes shared by the settings sections. */

export const rowClass =
	'flex items-center justify-between gap-4 min-h-12 px-4 py-2 text-[15px] text-slate-900 dark:text-dark-text no-underline';

export const linkRowClass = `${rowClass} hover:bg-slate-50 dark:hover:bg-dark-hover`;

/** Secondary text under a row's title. */
export const hintClass = 'text-xs text-slate-500 dark:text-dark-muted';

export const buttonClass =
	'shrink-0 h-9 px-4 rounded-full text-xs font-semibold bg-slate-100 dark:bg-dark-elevated text-slate-900 dark:text-dark-text hover:bg-slate-200 dark:hover:bg-dark-hover border-0 cursor-pointer disabled:opacity-60';

export const dangerButtonClass =
	'shrink-0 h-9 px-4 rounded-full text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/60 border-0 cursor-pointer disabled:opacity-60';

export const primaryButtonClass =
	'h-9 px-4 rounded-full text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

/** A form that opens under its row. */
export const panelClass = 'flex flex-col gap-3 px-4 py-4';

export const fieldClass = 'flex flex-col gap-1 text-sm';

export const inputClass =
	'h-10 px-3 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text';

export const errorClass = 'm-0 text-sm text-red-600 dark:text-red-400';
