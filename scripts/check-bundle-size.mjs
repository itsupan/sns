/*
 * Fails when the deployed Worker bundle or the client JS and CSS (gzipped) outgrow their budgets in
 * scripts/bundle-budgets.json. Run after `pnpm build`. Usage: pnpm check:bundle-size
 */
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareWithBudgets, formatReport, measureClient, measureWorker } from './bundle-size.mjs';

const CLIENT_DIR = '.svelte-kit/cloudflare/_app/immutable';
// `pnpm deploy:production` without the upload. The adapter output alone is not what ships:
// Wrangler bundles worker.ts (SvelteKit's worker plus the Durable Object classes).
const DRY_RUN_DEPLOY = 'exec wrangler deploy worker.ts --env production --dry-run'.split(' ');

const budgets = JSON.parse(await readFile(new URL('bundle-budgets.json', import.meta.url), 'utf8'));

const workerDir = await mkdtemp(join(tmpdir(), 'sns-worker-'));
try {
	execFileSync('pnpm', [...DRY_RUN_DEPLOY, '--outdir', workerDir], {
		stdio: ['ignore', 'ignore', 'inherit']
	});
	const rows = compareWithBudgets(
		{ worker: await measureWorker(workerDir), client: await measureClient(CLIENT_DIR) },
		budgets
	);
	console.log(formatReport(rows));
	if (rows.some(({ over }) => over)) {
		console.error(
			'\nOver budget: shrink the bundle, or raise its budget in scripts/bundle-budgets.json if the growth is worth it.'
		);
		process.exitCode = 1;
	}
} finally {
	await rm(workerDir, { recursive: true, force: true });
}
