/*
 * Fails when a migration added since <base> contains a contract statement without a
 * `-- contract-ok: <reason>` line. Usage: pnpm check:migrations <base-ref>
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { contractOkReason, findContractChanges, uniqueIndexesAfter } from './migration-safety.mjs';

const DIR = 'migrations';

const base = process.argv[2];
if (!base) {
	console.error('Usage: pnpm check:migrations <base-ref>');
	process.exit(2);
}

const inBase = new Set(
	execFileSync('git', ['ls-tree', '--name-only', base, `${DIR}/`], { encoding: 'utf8' }).split('\n')
);
const migrations = readdirSync(DIR)
	.filter((name) => name.endsWith('.sql'))
	.sort()
	.map((name) => ({ path: `${DIR}/${name}`, sql: readFileSync(`${DIR}/${name}`, 'utf8') }));

let checked = 0;
let failed = false;
for (const [i, { path, sql }] of migrations.entries()) {
	if (inBase.has(path)) continue;
	checked++;
	const before = uniqueIndexesAfter(migrations.slice(0, i).map((migration) => migration.sql));
	const changes = findContractChanges(sql, before);
	if (changes.length === 0) continue;

	const allowedBecause = contractOkReason(sql);
	if (allowedBecause) {
		console.log(`${path}: contract step allowed (${allowedBecause})`);
		continue;
	}
	failed = true;
	for (const { line, change, reason } of changes) {
		console.error(`${path}:${line}: ${change}: ${reason}`);
	}
}

if (failed) {
	console.error(
		'\nMigrations run before the new Worker is deployed, so they must keep the deployed code working.' +
			'\nShip the code change first and remove the old schema in a later release; mark that' +
			'\nmigration with a `-- contract-ok: <reason>` line (README → CI/CD).'
	);
	process.exit(1);
}
console.log(`Checked ${checked} new migration(s).`);
