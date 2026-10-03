/*
 * Spots "contract" statements in a D1 migration: ones the Worker that is still deployed may not
 * survive, because migrations are applied before the new Worker (see README → CI/CD).
 */

const IDENTIFIER = String.raw`(?:\`[^\`]*\`|"[^"]*"|\[[^\]]*\]|[A-Za-z_][\w$]*)`;
/** An optionally schema-qualified name; the group captures the name itself. */
const NAME = String.raw`(?:${IDENTIFIER}\s*\.\s*)?(${IDENTIFIER})`;

const DROP_COLUMN = new RegExp(String.raw`^ALTER\s+TABLE\s+${NAME}\s+DROP\b`, 'i');
const RENAME = new RegExp(String.raw`^ALTER\s+TABLE\s+${NAME}\s+RENAME\b`, 'i');
const CREATE_UNIQUE_INDEX = new RegExp(
	String.raw`^CREATE\s+UNIQUE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?${NAME}`,
	'i'
);
const DROP_INDEX = new RegExp(String.raw`^DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?${NAME}`, 'i');

/** Checked in order against each statement; a statement reports the first rule it matches. */
const CONTRACT_RULES = [
	{
		change: 'table rebuild',
		reason: 'copies the table into `__new_*` and drops the original, which cascades to child rows',
		test: (statement) => statement.includes('__new_')
	},
	{
		change: 'PRAGMA foreign_keys',
		reason: 'D1 always enforces foreign keys, so this cannot stop a DROP TABLE from cascading',
		test: (statement) => /^PRAGMA\s+foreign_keys\b/i.test(statement)
	},
	{
		change: 'DROP TABLE',
		reason: 'deletes rows the deployed Worker still reads and cascades to child rows',
		test: (statement) => /^DROP\s+TABLE\b/i.test(statement)
	},
	{
		change: 'DROP COLUMN',
		reason: 'removes a column the deployed Worker still reads or writes',
		test: (statement) => DROP_COLUMN.test(statement)
	},
	{
		change: 'RENAME',
		reason: 'the deployed Worker still uses the old name',
		test: (statement) => RENAME.test(statement)
	},
	{
		change: 'DROP INDEX (unique)',
		reason: 'the deployed Worker relies on it for uniqueness and ON CONFLICT targets',
		test: (statement, uniqueIndexes) => uniqueIndexes.has(indexName(DROP_INDEX, statement))
	}
];

// Quoted identifiers are matched (and kept) so a quote or `--` inside one is not mistaken for a
// string or comment.
const LEXEMES =
	/("[^"]*"|`[^`]*`|\[[^\]]*\])|--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|'(?:[^']|'')*(?:'|$)/g;

const CONTRACT_OK = /^[ \t]*--[ \t]*contract-ok:[ \t]*(\S.*)$/im;

/** The index a statement names, unquoted and lower-cased as SQLite compares them. */
function indexName(pattern, statement) {
	const name = pattern.exec(statement)?.[1];
	return name && (/^[`"[]/.test(name) ? name.slice(1, -1) : name).toLowerCase();
}

/**
 * The statements of a migration with comments and string literals blanked out, each with the
 * line it starts on.
 * @param {string} sql
 */
function statementsOf(sql) {
	const masked = sql.replace(LEXEMES, (lexeme, identifier) =>
		identifier ? lexeme : lexeme.replace(/[^\n]/g, ' ')
	);
	const statements = [];
	let offset = 0;
	for (const part of masked.split(';')) {
		const text = part.trim();
		if (text) {
			const start = offset + part.length - part.trimStart().length;
			statements.push({ text, line: masked.slice(0, start).split('\n').length });
		}
		offset += part.length + 1;
	}
	return statements;
}

/**
 * Names of the unique indexes that exist once `migrations` have been applied in order.
 * @param {string[]} migrations
 * @returns {Set<string>}
 */
export function uniqueIndexesAfter(migrations) {
	const uniqueIndexes = new Set();
	for (const { text } of migrations.flatMap((sql) => statementsOf(sql))) {
		const created = indexName(CREATE_UNIQUE_INDEX, text);
		if (created) uniqueIndexes.add(created);
		const dropped = indexName(DROP_INDEX, text);
		if (dropped) uniqueIndexes.delete(dropped);
	}
	return uniqueIndexes;
}

/**
 * Lists the statements of a migration that the currently deployed code may not survive.
 * @param {string} sql
 * @param {Set<string>} uniqueIndexes the unique indexes that exist before this migration
 * @returns {{ line: number, change: string, reason: string }[]}
 */
export function findContractChanges(sql, uniqueIndexes) {
	return statementsOf(sql).flatMap(({ text, line }) => {
		const rule = CONTRACT_RULES.find(({ test }) => test(text, uniqueIndexes));
		return rule ? [{ line, change: rule.change, reason: rule.reason }] : [];
	});
}

/**
 * The reason given on a `-- contract-ok: <reason>` line, which allows a deliberate contract step.
 * @param {string} sql
 * @returns {string | undefined}
 */
export function contractOkReason(sql) {
	return CONTRACT_OK.exec(sql)?.[1].trim();
}
