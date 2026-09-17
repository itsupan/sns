import { defineConfig } from '@playwright/test';

export default defineConfig({
	testMatch: '**/*.e2e.{ts,js}',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: { baseURL: 'http://localhost:4173' },
	webServer: {
		command: 'pnpm run build && pnpm run db:setup:local && pnpm run preview',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
