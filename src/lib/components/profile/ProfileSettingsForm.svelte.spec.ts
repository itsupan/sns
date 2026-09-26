import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import ProfileSettingsForm from './ProfileSettingsForm.svelte';

describe('ProfileSettingsForm', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it('renders all profile form inputs with initial values', async () => {
		const initialData = {
			id: 'user-123',
			name: 'Elena Rostova',
			handle: 'elena.rostova',
			title: 'Architectural Photographer',
			bio: 'Capturing silence, light, and geometries.',
			website: 'elenarostova.com',
			location: 'Stockholm & Kyoto',
			cameraGear: 'Leica M11'
		};

		const screen = render(ProfileSettingsForm, {
			props: {
				initialData,
				userId: 'user-123'
			}
		});

		await expect.element(screen.getByText('Edit Profile')).toBeInTheDocument();
		await expect.element(screen.getByLabelText('Display Name *')).toHaveValue('Elena Rostova');
		await expect.element(screen.getByLabelText('Username / Handle')).toHaveValue('elena.rostova');
		await expect
			.element(screen.getByLabelText('Title / Profession'))
			.toHaveValue('Architectural Photographer');
		await expect
			.element(screen.getByLabelText('Bio'))
			.toHaveValue('Capturing silence, light, and geometries.');
		await expect.element(screen.getByLabelText('Website')).toHaveValue('elenarostova.com');
		await expect.element(screen.getByLabelText('Location')).toHaveValue('Stockholm & Kyoto');
		await expect.element(screen.getByLabelText('Camera Gear / Setup')).toHaveValue('Leica M11');
	});

	it('submits form data to PATCH /api/users/:id and triggers onSuccess callback', async () => {
		const initialData = {
			id: 'user-123',
			name: 'Elena Rostova',
			handle: 'elena.rostova'
		};

		const updatedUser = {
			...initialData,
			name: 'Elena New Name',
			bio: 'New bio'
		};

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ success: true, user: updatedUser })
		} as Response);

		globalThis.fetch = mockFetch;

		const onSuccess = vi.fn();
		const screen = render(ProfileSettingsForm, {
			props: {
				initialData,
				userId: 'user-123',
				onSuccess
			}
		});

		// Modify name input to make the form dirty
		const nameInput = screen.getByLabelText('Display Name *');
		await nameInput.fill('Elena New Name');

		// Click Save Changes button
		const saveBtn = screen.getByRole('button', { name: 'Save Changes' });
		await saveBtn.click();

		expect(mockFetch).toHaveBeenCalledWith(
			'/api/users/user-123',
			expect.objectContaining({
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: expect.stringContaining('"name":"Elena New Name"')
			})
		);

		expect(onSuccess).toHaveBeenCalledWith(updatedUser);
	});

	it('displays error if PATCH returns an error response', async () => {
		const initialData = {
			id: 'user-123',
			name: 'Elena Rostova',
			handle: 'elena.rostova'
		};

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 409,
			json: async () => ({ error: 'This handle is already taken', field: 'handle' })
		} as Response);

		const screen = render(ProfileSettingsForm, {
			props: {
				initialData,
				userId: 'user-123'
			}
		});

		const handleInput = screen.getByLabelText('Username / Handle');
		await handleInput.fill('already_taken');

		const saveBtn = screen.getByRole('button', { name: 'Save Changes' });
		await saveBtn.click();

		await expect.element(screen.getByText('This handle is already taken')).toBeInTheDocument();
	});
});
