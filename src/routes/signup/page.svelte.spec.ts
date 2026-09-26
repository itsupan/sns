import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import SignupPage from './+page.svelte';

describe('Signup Page', () => {
	it('renders signup form according to design requirements', async () => {
		const screen = render(SignupPage);

		// Kizuna branding
		await expect.element(screen.getByText('Kizuna', { exact: true })).toBeInTheDocument();

		// Tabs
		const signupTab = screen.getByRole('tab', { name: 'Sign Up' });
		await expect.element(signupTab).toBeInTheDocument();
		await expect.element(signupTab).toHaveClass('active');

		// Google button present, Apple button NOT present
		await expect.element(screen.getByText('Continue with Google')).toBeInTheDocument();
		await expect.element(screen.getByText('Continue with Apple')).not.toBeInTheDocument();

		// Divider
		await expect.element(screen.getByText('OR SIGN UP WITH EMAIL')).toBeInTheDocument();

		// Form fields
		await expect.element(screen.getByLabelText('Full name')).toBeInTheDocument();
		await expect.element(screen.getByLabelText('Email address')).toBeInTheDocument();
		await expect.element(screen.getByLabelText('Password', { exact: true })).toBeInTheDocument();

		// Primary submit button
		const submitBtn = screen.getByRole('button', { name: /Create Account/i });
		await expect.element(submitBtn).toBeInTheDocument();
		await expect.element(submitBtn).toHaveClass('btn-primary');

		// Switch to log in
		await expect.element(screen.getByText('Already have an account?')).toBeInTheDocument();
	});
});
