import { render } from 'vitest-browser-svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ForgotPasswordPage from './+page.svelte';

const requestPasswordReset = vi.hoisted(() => vi.fn());
vi.mock('$lib/auth-client', () => ({ authClient: { requestPasswordReset } }));

beforeEach(() => requestPasswordReset.mockReset());

describe('Forgot password page', () => {
	it('asks for a reset link and shows the same neutral confirmation', async () => {
		requestPasswordReset.mockResolvedValue({ data: { status: true }, error: null });
		const screen = render(ForgotPasswordPage);

		await screen.getByLabelText('Email address').fill(' ada@example.com ');
		await screen.getByRole('button', { name: 'Send reset link' }).click();

		await expect
			.element(screen.getByRole('status'))
			.toHaveTextContent("If an account exists for ada@example.com, we've sent it a link");
		expect(requestPasswordReset).toHaveBeenCalledWith({
			email: 'ada@example.com',
			redirectTo: '/reset-password',
			fetchOptions: { headers: { 'x-captcha-response': '' } }
		});
		await expect
			.element(screen.getByRole('link', { name: 'Back to log in' }))
			.toHaveAttribute('href', '/login');
	});

	it('shows errors that do not depend on the account, like a rate limit', async () => {
		requestPasswordReset.mockResolvedValue({
			data: null,
			error: { code: 'RATE_LIMITED', message: 'Too many requests.' }
		});
		const screen = render(ForgotPasswordPage);

		await screen.getByLabelText('Email address').fill('ada@example.com');
		await screen.getByRole('button', { name: 'Send reset link' }).click();

		await expect.element(screen.getByRole('alert')).toHaveTextContent('Too many requests.');
		await expect.element(screen.getByLabelText('Email address')).toBeInTheDocument();
	});

	it('needs an email before sending', async () => {
		const screen = render(ForgotPasswordPage);
		await screen.getByRole('button', { name: 'Send reset link' }).click();
		await expect.element(screen.getByRole('alert')).toHaveTextContent('Please enter your email');
		expect(requestPasswordReset).not.toHaveBeenCalled();
	});
});
