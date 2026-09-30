import { expect, test } from '@playwright/test';

test('home page renders with layout header and brand link', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kizuna home feed');
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
	await expect(page.getByRole('button', { name: /Share an observation/ })).toBeVisible();

	// Composer opens as a bottom sheet
	await page.getByRole('button', { name: 'Create post' }).click();
	await expect(page.getByRole('dialog', { name: 'Create post' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();
	await page.keyboard.press('Escape');

	// Mobile bottom navigation must be visible
	await expect(page.getByRole('navigation', { name: 'Mobile Navigation' })).toBeVisible();
});

test('profile page is a protected route and redirects unauthenticated user to login on desktop', async ({
	page
}) => {
	await page.goto('/profile');

	// Unauthenticated request must be redirected to /login with redirectTo query param
	await expect(page).toHaveURL(/\/login\?redirectTo=/);
	await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
	await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
});

test('profile page redirects unauthenticated user to login on mobile', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/profile');

	// Unauthenticated mobile user must be redirected to login
	await expect(page).toHaveURL(/\/login/);
	await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
});

test('random route on url displays 404 error page with feed navigation', async ({ page }) => {
	const response = await page.goto('/random-nonexistent-path-xyz');
	expect(response?.status()).toBe(404);
	await expect(page.getByText('404')).toBeVisible();
	await expect(page.getByText('Page Not Found · ページが見つかりません')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Return to Feed' })).toBeVisible();

	// Clicking Return to Feed navigates home
	await page.getByRole('link', { name: 'Return to Feed' }).click();
	await expect(page).toHaveURL('/');
});

test('feed post with multiple images displays carousel counter and navigates slides', async ({
	page
}) => {
	await page.goto('/');

	// Target the curated multi-image exhibition post
	const multiPost = page.locator('article', {
		hasText: 'Quiet Brutalism: Concrete Light & Shadows'
	});
	await multiPost.scrollIntoViewIfNeeded();
	await expect(multiPost.getByText('1/4')).toBeVisible();

	// Click next slide button
	const nextButton = multiPost.getByRole('button', { name: 'Next slide' });
	await nextButton.click({ force: true });

	// Slide counter updates to 2/4
	await expect(multiPost.getByText('2/4')).toBeVisible();
});

test('public profile page displays curator posts in curated grid', async ({ page }) => {
	await page.goto('/profile/@elena.rostova');

	// Elena's profile and bio should be rendered
	await expect(page.getByText('Elena Rostova').first()).toBeVisible();
	await expect(page.getByText('@elena.rostova').first()).toBeVisible();

	// Her real posts from the database should be visible in the Curated Grid
	await expect(
		page.getByRole('button', { name: /View post Quiet Brutalism: Concrete Light & Shadows/i })
	).toBeVisible();

	// Verify SEO Open Graph & Twitter meta tags contain image
	const ogImage = page.locator('meta[property="og:image"]');
	await expect(ogImage).toHaveAttribute('content', /https?:\/\/.+/);

	const twitterCard = page.locator('meta[name="twitter:card"]');
	await expect(twitterCard).toHaveAttribute('content', 'summary_large_image');
});

test('individual post page renders with rich SEO Open Graph tags containing image', async ({
	page
}) => {
	await page.goto('/post/post-1');

	// Verify post content is displayed
	await expect(
		page.getByRole('heading', { name: 'Quiet Brutalism: Concrete Light & Shadows', exact: true })
	).toBeVisible();
	await expect(page.getByText('Elena Rostova').first()).toBeVisible();

	// Verify Open Graph & Twitter SEO tags contain post image
	const ogImage = page.locator('meta[property="og:image"]');
	await expect(ogImage).toHaveAttribute('content', /https?:\/\/.+/);

	const ogType = page.locator('meta[property="og:type"]');
	await expect(ogType).toHaveAttribute('content', 'article');

	const twitterCard = page.locator('meta[name="twitter:card"]');
	await expect(twitterCard).toHaveAttribute('content', 'summary_large_image');

	// Click "Back to feed" link
	await page.getByRole('link', { name: 'Back to feed' }).click();
	await expect(page).toHaveURL('/');
});

test('share post modal creates dedicated SEO URL for other platforms', async ({ page }) => {
	await page.goto('/');

	// Open share post modal on first post
	const shareBtn = page.getByRole('button', { name: /Share post/i }).first();
	await shareBtn.click();

	// Verify modal contains preview image
	const modal = page.getByRole('dialog', { name: 'Share Post' });
	await expect(modal).toBeVisible();
	await expect(modal.locator('img').first()).toBeVisible();

	// Verify platform links target /post/[id]
	const telegramLink = modal.getByRole('link', { name: /Telegram/i });
	await expect(telegramLink).toHaveAttribute('href', /post%2F/);
});

test('Create in the mobile nav opens the composer from another page', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/profile/elena.rostova');
	await page.getByRole('button', { name: 'Create post' }).click();

	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole('dialog', { name: 'Create post' })).toBeVisible();
});

test('Explore opens from the nav and shows the discovery grid signed out', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	await page
		.getByRole('navigation', { name: 'Mobile Navigation' })
		.getByRole('link', { name: 'Explore' })
		.click();

	await expect(page).toHaveURL(/\/explore$/);
	await expect(page.getByRole('heading', { name: 'Explore', level: 1 })).toBeVisible();
});
