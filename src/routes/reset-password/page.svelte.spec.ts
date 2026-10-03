import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from '$lib/utils/toast.svelte';
import ResetPasswordPage from './+page.svelte';

const mocks = vi.hoisted(() => ({
	url: new URL('http://localhost/reset-password'),
	resetPassword: vi.fn(),
	goto: vi.fn()
}));
vi.mock('$app/state', () => ({
	page: {
		get url() {
			return mocks.url;
		}
	}
}));
vi.mock('$app/navigation', () => ({ goto: mocks.goto }));
vi.mock('$lib/auth-client', () => ({ authClient: { resetPassword: mocks.resetPassword } }));

afterEach(() => {
	mocks.resetPassword.mockReset();
	mocks.goto.mockReset();
	toast.dismiss();
});

async function submit(screen: ReturnType<typeof render>, password: string, confirmation: string) {
	await screen.getByLabelText('New password', { exact: true }).fill(password);
	await screen.getByLabelText('Confirm password', { exact: true }).fill(confirmation);
	await screen.getByRole('button', { name: 'Reset password' }).click();
}

describe('Reset password page', () => {
	it('sets the new password with the token from the link, then goes to login', async () => {
		mocks.url = new URL('http://localhost/reset-password?token=tok3n');
		mocks.resetPassword.mockResolvedValue({ data: { status: true }, error: null });
		const screen = render(ResetPasswordPage);

		await submit(screen, 'new-password', 'new-password');

		await vi.waitFor(() => expect(mocks.goto).toHaveBeenCalledWith('/login'));
		expect(mocks.resetPassword).toHaveBeenCalledWith({
			newPassword: 'new-password',
			token: 'tok3n'
		});
		expect(toast.current?.text).toMatch(/password has been reset/);
	});

	it('applies the signup password rules before calling the server', async () => {
		mocks.url = new URL('http://localhost/reset-password?token=tok3n');
		const screen = render(ResetPasswordPage);

		await submit(screen, 'short', 'short');
		await expect.element(screen.getByRole('alert')).toHaveTextContent('at least 8 characters');
		await submit(screen, 'new-password', 'other-password');
		await expect.element(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.');
		expect(mocks.resetPassword).not.toHaveBeenCalled();
	});

	it.each([
		'http://localhost/reset-password',
		'http://localhost/reset-password?error=INVALID_TOKEN'
	])('explains that %s is not a usable link', async (url) => {
		mocks.url = new URL(url);
		const screen = render(ResetPasswordPage);

		await expect.element(screen.getByRole('alert')).toHaveTextContent('invalid or has expired');
		await expect
			.element(screen.getByRole('link', { name: 'Request a new link' }))
			.toHaveAttribute('href', '/forgot-password');
		await expect
			.element(screen.getByLabelText('New password', { exact: true }))
			.not.toBeInTheDocument();
	});

	it('switches to the expired state when the server rejects the token', async () => {
		mocks.url = new URL('http://localhost/reset-password?token=used');
		mocks.resetPassword.mockResolvedValue({
			data: null,
			error: { code: 'INVALID_TOKEN', message: 'Invalid token' }
		});
		const screen = render(ResetPasswordPage);

		await submit(screen, 'new-password', 'new-password');

		await expect.element(screen.getByRole('alert')).toHaveTextContent('invalid or has expired');
		expect(mocks.goto).not.toHaveBeenCalled();
	});
});
