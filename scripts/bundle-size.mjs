/*
 * Gzipped bundle sizes and their budgets (scripts/bundle-budgets.json, in KiB).
 */
import { readdir, readFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { gzipSync } from 'node:zlib';

const KIB = 1024;

async function filesIn(dir) {
	const entries = await readdir(dir, { recursive: true, withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name))
		.sort();
}

/**
 * Size of the modules written by `wrangler deploy --dry-run --outdir <dir>` (which also writes
 * their source maps and a README), gzipped together as Wrangler does when it reports the upload
 * size.
 * @param {string} dir
 */
export async function measureWorker(dir) {
	const modules = (await filesIn(dir)).filter(
		(file) => extname(file) !== '.map' && basename(file) !== 'README.md'
	);
	const contents = await Promise.all(modules.map((file) => readFile(file)));
	return gzipSync(Buffer.concat(contents)).byteLength;
}

/**
 * Total gzipped size of the JS and CSS files under `dir`, each gzipped on its own as the browser
 * downloads it.
 * @param {string} dir
 */
export async function measureClient(dir) {
	const assets = (await filesIn(dir)).filter((file) => ['.js', '.css'].includes(extname(file)));
	const sizes = await Promise.all(
		assets.map(async (file) => gzipSync(await readFile(file)).byteLength)
	);
	return sizes.reduce((total, size) => total + size, 0);
}

/**
 * @param {Record<string, number>} sizes gzipped bytes per bundle
 * @param {Record<string, number>} budgets KiB per bundle
 */
export function compareWithBudgets(sizes, budgets) {
	return Object.entries(sizes).map(([name, size]) => {
		if (!(name in budgets)) throw new Error(`No budget for "${name}" in bundle-budgets.json`);
		const budget = budgets[name] * KIB;
		return { name, size, budget, over: size > budget };
	});
}

/** @param {ReturnType<typeof compareWithBudgets>} rows */
export function formatReport(rows) {
	const kib = (bytes) => `${(bytes / KIB).toFixed(1)} KiB`;
	const width = Math.max('Bundle'.length, ...rows.map(({ name }) => name.length));
	const line = (name, size, budget, note = '') =>
		`${name.padEnd(width)}${size.padStart(12)}${budget.padStart(12)}${note}`;
	return [
		line('Bundle', 'gzip', 'budget'),
		...rows.map(({ name, size, budget, over }) =>
			line(name, kib(size), kib(budget), over ? '  over budget' : '')
		)
	].join('\n');
}
