import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import LoginPage from './+page.svelte';

describe('Login Page', () => {
	it('renders login form according to design requirements', async () => {
		const screen = render(LoginPage);

		// Kizuna branding
		await expect.element(screen.getByText('Kizuna', { exact: true })).toBeInTheDocument();
		await expect
			.element(screen.getByText('A curated visual space for photographers and minimalists.'))
			.toBeInTheDocument();

		// Tabs
		const loginTab = screen.getByRole('tab', { name: 'Log In' });
		const signupTab = screen.getByRole('tab', { name: 'Sign Up' });
		await expect.element(loginTab).toBeInTheDocument();
		await expect.element(signupTab).toBeInTheDocument();
		await expect.element(loginTab).toHaveClass('active');

		// Google button present, Apple button NOT present
		await expect.element(screen.getByText('Continue with Google')).toBeInTheDocument();
		await expect.element(screen.getByText('Continue with Apple')).not.toBeInTheDocument();

		// Divider
		await expect.element(screen.getByText('OR SIGN IN WITH EMAIL')).toBeInTheDocument();

		// Form fields
		await expect.element(screen.getByLabelText('Email address')).toBeInTheDocument();
		await expect.element(screen.getByLabelText('Password', { exact: true })).toBeInTheDocument();
		await expect.element(screen.getByText('Forgot password?')).toBeInTheDocument();
		await expect.element(screen.getByText('Remember me')).toBeInTheDocument();
		await expect.element(screen.getByText('256-bit encrypted')).toBeInTheDocument();

		// Primary submit button
		const submitBtn = screen.getByRole('button', { name: /Sign In/i });
		await expect.element(submitBtn).toBeInTheDocument();
		await expect.element(submitBtn).toHaveClass('btn-primary');

		// Switch to sign up
		await expect.element(screen.getByText("Don't have an account?")).toBeInTheDocument();
	});
});
