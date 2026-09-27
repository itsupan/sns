import * as v from 'valibot';
import { ApiError, type FieldErrors } from './errors';

type AnySchema = v.GenericSchema | v.GenericSchemaAsync;

async function validate<S extends AnySchema>(schema: S, input: unknown): Promise<v.InferOutput<S>> {
	const result = await v.safeParseAsync(schema, input);
	if (result.success) return result.output;

	const flat = v.flatten(result.issues);
	const fields: FieldErrors = {};
	for (const [key, messages] of Object.entries(flat.nested ?? {})) {
		if (messages?.[0]) fields[key] = messages[0];
	}
	const message = flat.root?.[0] ?? 'Invalid request';
	throw new ApiError(400, 'validation_failed', message, fields);
}

/** Parses the JSON body against `schema`; throws a 400 `ApiError` on bad JSON or invalid fields. */
export async function parseBody<S extends AnySchema>(
	request: Request,
	schema: S
): Promise<v.InferOutput<S>> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON');
	}
	return validate(schema, body);
}

/**
 * Validates query params against `schema`. Values arrive as strings (the last one wins for
 * repeated keys), so use `v.pipe(v.string(), v.toNumber())` etc. for non-string fields.
 */
export function parseQuery<S extends AnySchema>(url: URL, schema: S): Promise<v.InferOutput<S>> {
	return validate(schema, Object.fromEntries(url.searchParams));
}
