export interface ParsedApiError {
	code?: string;
	message: string;
	fields?: Record<string, string>;
}

/**
 * Reads an `/api/*` error body (`{ error: { code, message, fields? } }`).
 * Also accepts the legacy `{ error: string }` shape so callers never break mid-migration.
 */
export function readApiError(data: unknown, fallback: string): ParsedApiError {
	const error = (data as { error?: unknown } | null)?.error;
	if (typeof error === 'string') return { message: error };
	if (error && typeof error === 'object') {
		const { code, message, fields } = error as Partial<ParsedApiError>;
		return { code, message: typeof message === 'string' ? message : fallback, fields };
	}
	return { message: fallback };
}
