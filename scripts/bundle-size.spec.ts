import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compareWithBudgets, formatReport, measureClient, measureWorker } from './bundle-size.mjs';

const gzipped = (text: string) => gzipSync(text).byteLength;

describe('measuring', () => {
	let dir: string;

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'bundle-size-'));
		await mkdir(join(dir, 'chunks'));
		await writeFile(join(dir, 'chunks', 'app.css'), 'body { margin: 0 }');
		await writeFile(join(dir, 'chunks', 'page.js'), 'console.log("page");');
		await writeFile(join(dir, 'chunks', 'parser.wasm'), 'wasm bytes');
		await writeFile(join(dir, 'worker.js'), 'export const a = 1;'.repeat(50));
		await writeFile(join(dir, 'worker.js.map'), '{"version":3}');
		await writeFile(join(dir, 'README.md'), 'This folder contains the built output assets');
	});

	afterEach(() => rm(dir, { recursive: true, force: true }));

	it('sums the client JS and CSS, each file gzipped on its own', async () => {
		expect(await measureClient(dir)).toBe(
			gzipped('body { margin: 0 }') +
				gzipped('console.log("page");') +
				gzipped('export const a = 1;'.repeat(50))
		);
	});

	it('gzips the Worker modules together, without source maps or the README', async () => {
		expect(await measureWorker(dir)).toBe(
			gzipped(
				'body { margin: 0 }' +
					'console.log("page");' +
					'wasm bytes' +
					'export const a = 1;'.repeat(50)
			)
		);
	});
});

describe('compareWithBudgets', () => {
	it('flags only bundles above their budget', () => {
		expect(compareWithBudgets({ worker: 1024, client: 2049 }, { worker: 1, client: 2 })).toEqual([
			{ name: 'worker', size: 1024, budget: 1024, over: false },
			{ name: 'client', size: 2049, budget: 2048, over: true }
		]);
	});

	it('refuses a bundle without a budget', () => {
		expect(() => compareWithBudgets({ worker: 1 }, {})).toThrow('No budget for "worker"');
	});
});

describe('formatReport', () => {
	it('prints one row per bundle in KiB and marks those over budget', () => {
		const report = formatReport([
			{ name: 'worker', size: 700 * 1024, budget: 770 * 1024, over: false },
			{ name: 'client', size: 320 * 1024, budget: 300 * 1024, over: true }
		]);
		expect(report.split('\n')).toEqual([
			'Bundle        gzip      budget',
			'worker   700.0 KiB   770.0 KiB',
			'client   320.0 KiB   300.0 KiB  over budget'
		]);
	});
});
