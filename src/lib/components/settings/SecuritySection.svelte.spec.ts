import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from '$lib/utils/toast.svelte';
import SecuritySection from './SecuritySection.svelte';

const mocks = vi.hoisted(() => ({
	url: new URL('http://localhost/settings'),
	goto: vi.fn(),
	invalidateAll: vi.fn(),
	authClient: {
		sendVerificationEmail: vi.fn(),
		changeEmail: vi.fn(),
		changePassword: vi.fn(),
		revokeOtherSessions: vi.fn()
	}
}));
vi.mock('$app/state', () => ({
	page: {
		get url() {
			return mocks.url;
		}
	}
}));
vi.mock('$app/navigation', () => ({ goto: mocks.goto, invalidateAll: mocks.invalidateAll }));
vi.mock('$lib/auth-client', () => ({ authClient: mocks.authClient }));

const ok = { data: { status: true }, error: null };
const sessions = [
	{
		id: 's-here',
		device: 'Chrome on macOS',
		createdAt: new Date('2026-09-20'),
		lastActiveAt: new Date('2026-10-02'),
		current: true
	},
	{
		id: 's-phone',
		device: 'Safari on iPhone',
		createdAt: new Date('2026-09-01'),
		lastActiveAt: new Date('2026-09-30'),
		current: false
	},
	{
		id: 's-old',
		device: 'Firefox on Windows',
		createdAt: new Date('2026-08-01'),
		lastActiveAt: new Date('2026-09-02'),
		current: false
	}
];
const props = {
	email: 'ada@example.com',
	emailVerified: true,
	hasPassword: true,
	socialProviders: [],
	sessions
};

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
	mocks.url = new URL('http://localhost/settings');
	toast.dismiss();
});

describe('SecuritySection', () => {
	it('shows a verified email without the banner', async () => {
		const screen = render(SecuritySection, { props });
		await expect.element(screen.getByText('Verified', { exact: true })).toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: 'Resend verification email' }))
			.not.toBeInTheDocument();
	});

	it('warns about an unverified email and resends the link', async () => {
		mocks.authClient.sendVerificationEmail.mockResolvedValue(ok);
		const screen = render(SecuritySection, { props: { ...props, emailVerified: false } });

		await expect.element(screen.getByText(/isn't verified yet/)).toBeInTheDocument();
		await screen.getByRole('button', { name: 'Resend verification email' }).click();

		await vi.waitFor(() =>
			expect(toast.current?.text).toBe('We sent a verification link to ada@example.com')
		);
		expect(mocks.authClient.sendVerificationEmail).toHaveBeenCalledWith({
			email: 'ada@example.com',
			callbackURL: '/settings?verified=1'
		});
	});

	it('changes the email through the current address of a verified account', async () => {
		mocks.authClient.changeEmail.mockResolvedValue(ok);
		const screen = render(SecuritySection, { props });

		await screen.getByRole('button', { name: 'Change' }).first().click();
		await screen.getByLabelText('New email').fill('new@example.com');
		await screen.getByRole('button', { name: 'Send link' }).click();

		await vi.waitFor(() =>
			expect(toast.current?.text).toBe('Check ada@example.com for a link to approve the change')
		);
		expect(mocks.authClient.changeEmail).toHaveBeenCalledWith({
			newEmail: 'new@example.com',
			callbackURL: '/settings?newEmail=new%40example.com'
		});
		await expect.element(screen.getByLabelText('New email')).not.toBeInTheDocument();
	});

	it('shows why an email change was refused', async () => {
		mocks.authClient.changeEmail.mockResolvedValue({
			data: null,
			error: { code: 'EMAIL_NOT_ALLOWED', message: 'This email cannot be used for an account.' }
		});
		const screen = render(SecuritySection, { props });

		await screen.getByRole('button', { name: 'Change' }).first().click();
		await screen.getByLabelText('New email').fill('blocked@example.com');
		await screen.getByRole('button', { name: 'Send link' }).click();

		await expect.element(screen.getByRole('alert')).toHaveTextContent('cannot be used');
	});

	it('changes the password, signing out other sessions', async () => {
		mocks.authClient.changePassword.mockResolvedValue({ data: {}, error: null });
		const screen = render(SecuritySection, { props });

		await screen.getByRole('button', { name: 'Change' }).nth(1).click();
		await screen.getByLabelText('Current password').fill('old-password');
		await screen.getByLabelText('New password', { exact: true }).fill('new-password');
		await screen.getByLabelText('Confirm new password').fill('new-password');
		await screen.getByRole('button', { name: 'Change password' }).click();

		await vi.waitFor(() => expect(mocks.invalidateAll).toHaveBeenCalled());
		expect(mocks.authClient.changePassword).toHaveBeenCalledWith({
			currentPassword: 'old-password',
			newPassword: 'new-password',
			revokeOtherSessions: true
		});
	});

	it('checks the new password locally and explains a wrong current one', async () => {
		mocks.authClient.changePassword.mockResolvedValue({
			data: null,
			error: { code: 'INVALID_PASSWORD', message: 'Invalid password' }
		});
		const screen = render(SecuritySection, { props });

		await screen.getByRole('button', { name: 'Change' }).nth(1).click();
		await screen.getByLabelText('Current password').fill('old-password');
		await screen.getByLabelText('New password', { exact: true }).fill('new-password');
		await screen.getByLabelText('Confirm new password').fill('typo-password');
		await screen.getByRole('button', { name: 'Change password' }).click();
		await expect.element(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.');
		expect(mocks.authClient.changePassword).not.toHaveBeenCalled();

		await screen.getByLabelText('Confirm new password').fill('new-password');
		await screen.getByRole('button', { name: 'Change password' }).click();
		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('Your current password is incorrect.');
	});

	it('shows how a Google-only account signs in instead of a password form', async () => {
		const screen = render(SecuritySection, {
			props: { ...props, hasPassword: false, socialProviders: ['google'] }
		});

		await expect.element(screen.getByText('Sign-in method')).toBeInTheDocument();
		await expect.element(screen.getByText('Google', { exact: true })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Change' }).all()).toHaveLength(1);
		await expect.element(screen.getByText('Password', { exact: true })).not.toBeInTheDocument();
	});

	it('lists sessions, marks this device and signs one out', async () => {
		const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
		vi.stubGlobal('fetch', fetchMock);
		const screen = render(SecuritySection, { props });

		await expect.element(screen.getByText('This device')).toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: 'Sign out Chrome on macOS' }))
			.not.toBeInTheDocument();

		await screen.getByRole('button', { name: 'Sign out Safari on iPhone' }).click();

		await expect.element(screen.getByText('Safari on iPhone')).not.toBeInTheDocument();
		expect(fetchMock).toHaveBeenCalledWith('/api/account/sessions/s-phone', { method: 'DELETE' });
		await expect.element(screen.getByText('Firefox on Windows')).toBeInTheDocument();
	});

	it('signs out of every other session', async () => {
		mocks.authClient.revokeOtherSessions.mockResolvedValue(ok);
		const screen = render(SecuritySection, { props });

		await screen.getByRole('button', { name: 'Sign out of other sessions' }).click();

		await expect.element(screen.getByText('Firefox on Windows')).not.toBeInTheDocument();
		await expect.element(screen.getByText('Safari on iPhone')).not.toBeInTheDocument();
		await expect.element(screen.getByText('Chrome on macOS')).toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: 'Sign out of other sessions' }))
			.not.toBeInTheDocument();
	});

	it('turns an email link result into a toast and clears the query', async () => {
		mocks.url = new URL('http://localhost/settings?verified=1&error=TOKEN_EXPIRED');
		render(SecuritySection, { props });

		await vi.waitFor(() =>
			expect(toast.current).toMatchObject({
				type: 'error',
				text: 'This link has expired. Request a new one.'
			})
		);
		expect(mocks.goto).toHaveBeenCalledWith('/settings', {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	});
});
