import { describe, expect, it } from 'vitest';
import { defaultProfile, resolveProfile } from './profile.svelte';

describe('profile utilities', () => {
	it('returns default profile when no user or session exists', () => {
		const profile = resolveProfile(undefined, null);
		expect(profile.name).toBe('Elena Rostova');
		expect(profile.title).toBe('Architectural & Film Photographer');
		expect(profile.bio).toContain('Capturing silence, light');
	});

	it('resolves session user data correctly', () => {
		const sessionUser = {
			name: 'Kenji Sato',
			email: 'kenji@example.com',
			handle: 'kenji.photo',
			bio: 'Street photographer in Tokyo',
			title: 'Visual Storyteller',
			website: 'kenjisato.com',
			location: 'Tokyo, Japan',
			cameraGear: 'Fujifilm X100V',
			image: 'https://example.com/avatar.jpg'
		};

		const profile = resolveProfile(sessionUser, null);
		expect(profile.name).toBe('Kenji Sato');
		expect(profile.handle).toBe('kenji.photo');
		expect(profile.bio).toBe('Street photographer in Tokyo');
		expect(profile.avatar).toBe('https://example.com/avatar.jpg');
		expect(profile.cameraGear).toBe('Fujifilm X100V');
	});

	it('strips leading @ from handle', () => {
		const sessionUser = {
			name: 'Aoi Tanaka',
			handle: '@aoi_minimal'
		};

		const profile = resolveProfile(sessionUser, null);
		expect(profile.handle).toBe('aoi_minimal');
	});

	it('falls back to email prefix when handle is missing', () => {
		const sessionUser = {
			name: 'Marcus Chen',
			email: 'marcus.chen@example.com'
		};

		const profile = resolveProfile(sessionUser, null);
		expect(profile.handle).toBe('marcus.chen');
	});

	it('prioritizes updatedUser over sessionUser', () => {
		const sessionUser = {
			name: 'Old Name',
			bio: 'Old bio'
		};
		const updatedUser = {
			name: 'New Name',
			bio: 'New updated bio'
		};

		const profile = resolveProfile(sessionUser, updatedUser);
		expect(profile.name).toBe('New Name');
		expect(profile.bio).toBe('New updated bio');
	});

	it('allows custom overrides to take precedence', () => {
		const profile = resolveProfile(undefined, null, { name: 'Guest Curator' });
		expect(profile.name).toBe('Guest Curator');
		expect(profile.handle).toBe(defaultProfile.handle);
	});
});
