import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import AuthCard from './AuthCard.svelte';

describe('AuthCard signup consent', () => {
	it('asks the user to confirm they are 13+ and agree to the Terms and Privacy Policy', async () => {
		const screen = await render(AuthCard, { mode: 'signup' });

		const label = screen.container.querySelector('.checkbox-label');
		expect(label?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
			"I'm 13 or older and agree to the Terms and Privacy Policy"
		);

		const links = label!.querySelectorAll('a');
		expect([...links].map((a) => [a.textContent, a.getAttribute('href'), a.target])).toEqual([
			['Terms', '/legal/terms', '_blank'],
			['Privacy Policy', '/legal/privacy', '_blank']
		]);
		await expect.element(screen.getByRole('checkbox')).toBeInTheDocument();
	});
});
