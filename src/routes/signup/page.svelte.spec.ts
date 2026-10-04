import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import SignupPage from './+page.svelte';

describe('Signup Page', () => {
	it('renders signup form according to design requirements', async () => {
		const screen = await render(SignupPage);

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
		await expect
			.element(screen.getByLabelText('Confirm password', { exact: true }))
			.toBeInTheDocument();

		// Primary submit button
		const submitBtn = screen.getByRole('button', { name: /Create Account/i });
		await expect.element(submitBtn).toBeInTheDocument();
		await expect.element(submitBtn).toHaveClass('btn-primary');

		// Switch to log in
		await expect.element(screen.getByText('Already have an account?')).toBeInTheDocument();
	});

	it('validates password mismatch on signup', async () => {
		const screen = await render(SignupPage);

		const nameInput = screen.getByLabelText('Full name');
		const emailInput = screen.getByLabelText('Email address');
		const passwordInput = screen.getByLabelText('Password', { exact: true });
		const confirmPasswordInput = screen.getByLabelText('Confirm password', { exact: true });
		const termsCheckbox = screen.getByRole('checkbox');

		await nameInput.fill('Test User');
		await emailInput.fill('test@example.com');
		await passwordInput.fill('password123');
		await confirmPasswordInput.fill('differentpassword');
		await termsCheckbox.click();

		const submitBtn = screen.getByRole('button', { name: /Create Account/i });
		await submitBtn.click();

		await expect.element(screen.getByText('Passwords do not match.')).toBeInTheDocument();
	});
});
