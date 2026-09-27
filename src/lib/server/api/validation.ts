import * as v from 'valibot';
import { ApiError, type FieldErrors } from './errors';

type AnySchema = v.GenericSchema | v.GenericSchemaAsync;

function isMissingKey(issue: v.GenericIssue): boolean {
	return issue.kind === 'schema' && issue.type === 'object' && issue.input === undefined;
}

/** `contentType` → `Content type`, `profile.name` → `Name`. */
function humanize(key: string): string {
	const words = (key.split('.').pop() ?? key).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

async function validate<S extends AnySchema>(schema: S, input: unknown): Promise<v.InferOutput<S>> {
	const result = await v.safeParseAsync(schema, input);
	if (result.success) return result.output;

	const fields: FieldErrors = {};
	let rootMessage: string | undefined;
	for (const issue of result.issues) {
		const key = v.getDotPath(issue);
		// A missing key reports "Invalid key: …" instead of the entry's own message.
		const message = key && isMissingKey(issue) ? `${humanize(key)} is required` : issue.message;
		if (key === null) rootMessage ??= message;
		else fields[key] ??= message;
	}
	const message = rootMessage ?? Object.values(fields)[0] ?? 'Invalid request';
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
