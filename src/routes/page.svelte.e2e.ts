import { expect, test } from '@playwright/test';

test('home page renders with layout header and brand link', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toHaveText('sns');
	await expect(page.getByRole('link', { name: /Kizuna/i }).first()).toBeVisible();
	await expect(page.getByText('Quiet Brutalism: Concrete Light & Shadows')).toBeVisible();
	await expect(page.getByText('Curators to Follow')).toBeVisible();
});

test('health endpoint reports a reachable database', async ({ request }) => {
	const response = await request.get('/api/health');

	expect(response.status()).toBe(200);
	expect(await response.json()).toMatchObject({ status: 'ok', database: 'ok', kv: 'ok' });
});

test('login page renders with Kizuna styling, Google sign in, and black primary button', async ({
	page
}) => {
	await page.goto('/login');

	// Verify layout header is NOT present on auth pages
	await expect(page.locator('header')).not.toBeVisible();

	// Verify Kizuna brand in auth card
	await expect(page.locator('.brand-title')).toHaveText('Kizuna');
	await expect(
		page.getByText('A curated visual space for photographers and minimalists.')
	).toBeVisible();

	// Verify Google OAuth button and ensure Apple button is not present
	await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Continue with Apple' })).not.toBeVisible();

	// Verify primary black button
	const submitButton = page.getByRole('button', { name: /Sign In/i });
	await expect(submitButton).toBeVisible();
	await expect(submitButton).toHaveClass(/btn-primary/);

	// Verify tab switcher
	const signupTab = page.getByRole('tab', { name: 'Sign Up' });
	await signupTab.click();
	await expect(page).toHaveURL(/\/signup/);
	await expect(page.getByRole('button', { name: /Create Account/i })).toBeVisible();
});

test('signup page renders and allows switching back to login', async ({ page }) => {
	await page.goto('/signup');

	// Verify layout header is NOT present on auth pages
	await expect(page.locator('header')).not.toBeVisible();

	await expect(page.getByRole('button', { name: /Create Account/i })).toBeVisible();
	await expect(page.getByLabel('Full name')).toBeVisible();

	const loginTab = page.getByRole('tab', { name: 'Log In' });
	await loginTab.click();
	await expect(page).toHaveURL(/\/login/);
	await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
});

test('auth page adapts responsively on mobile without a card container', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/login');

	const authCard = page.locator('.auth-card');
	await expect(authCard).toBeVisible();

	// Verify mobile specific classes: seamless transparent background, no border, no shadow
	await expect(authCard).toHaveClass(/bg-transparent/);
	await expect(authCard).toHaveClass(/rounded-none/);
	await expect(authCard).toHaveClass(/border-0/);
	await expect(authCard).toHaveClass(/shadow-none/);

	// Desktop classes are present for sm: breakpoint
	await expect(authCard).toHaveClass(/sm:rounded-3xl/);
	await expect(authCard).toHaveClass(/sm:border/);

	// Verify interactive elements remain visible on mobile
	await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
	await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
});

test('feed page on mobile hides sidebars and shows full-width main feed content', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');

	// Sidebars must NOT be visible on mobile
	await expect(page.getByRole('complementary', { name: 'Main Navigation' })).not.toBeVisible();
	await expect(page.getByRole('complementary', { name: 'Secondary Sidebar' })).not.toBeVisible();

	// Main post content, stories, and create box must be visible
	await expect(page.getByText('Quiet Brutalism: Concrete Light & Shadows')).toBeVisible();
	await expect(page.getByText('Your story')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();

	// Mobile bottom navigation must be visible
	await expect(page.getByRole('navigation', { name: 'Mobile Navigation' })).toBeVisible();
});

test('profile page renders master curator header, highlights, and gallery on desktop', async ({
	page
}) => {
	await page.goto('/profile');

	// Verify header elements
	await expect(page.getByRole('heading', { name: 'Elena Rostova' })).toBeVisible();
	await expect(page.getByText('MASTER CURATOR')).toBeVisible();
	await expect(page.getByRole('button', { name: /Send Message/i })).toBeVisible();

	// Verify story highlights
	await expect(page.getByRole('button', { name: "View highlight Kyoto '23" })).toBeVisible();

	// Verify tabs
	await expect(page.getByRole('tab', { name: 'Curated Grid' })).toBeVisible();
});

test('profile page adapts seamlessly to mobile layout', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/profile');

	// Curator heading is visible
	await expect(page.getByRole('heading', { name: 'Elena Rostova' })).toBeVisible();

	// Following and message action buttons visible
	await expect(page.getByRole('button', { name: /Following/i })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Message', exact: true })).toBeVisible();

	// Mobile bottom navigation remains docked
	await expect(page.getByRole('navigation', { name: 'Mobile Navigation' })).toBeVisible();
});
