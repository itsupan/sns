import { expect, test } from '@playwright/test';

test('home page renders', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toHaveText('sns');
});

test('health endpoint reports a reachable database', async ({ request }) => {
	const response = await request.get('/api/health');

	expect(response.status()).toBe(200);
	expect(await response.json()).toMatchObject({ status: 'ok', database: 'ok' });
});
