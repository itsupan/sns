import { json } from '@sveltejs/kit';

export type FieldErrors = Record<string, string>;

/** Standard error body returned by every `/api/*` route. */
export interface ApiErrorBody {
	error: { code: string; message: string; fields?: FieldErrors };
}

/** Thrown by helpers such as `requireUser` and `parseBody`; turned into a response by `withApi`. */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly fields?: FieldErrors,
		readonly headers?: HeadersInit
	) {
		super(message);
		this.name = 'ApiError';
	}

	toResponse(): Response {
		return apiError(this.status, this.code, this.message, this.fields, this.headers);
	}
}

export function apiError(
	status: number,
	code: string,
	message: string,
	fields?: FieldErrors,
	headers?: HeadersInit
): Response {
	const body: ApiErrorBody = { error: fields ? { code, message, fields } : { code, message } };
	return json(body, { status, headers });
}

/**
 * Wraps a request handler so a thrown `ApiError` becomes its JSON response.
 * Anything else (SvelteKit `error()`/`redirect()`, unexpected failures) is rethrown untouched.
 */
export function withApi<E>(handler: (event: E) => Response | Promise<Response>) {
	return async (event: E): Promise<Response> => {
		try {
			return await handler(event);
		} catch (err) {
			if (err instanceof ApiError) return err.toResponse();
			throw err;
		}
	};
}
