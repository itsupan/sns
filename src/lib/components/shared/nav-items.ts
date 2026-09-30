import { tick } from 'svelte';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

export type NavId = 'home' | 'explore' | 'create' | 'activity' | 'saved' | 'profile';

export interface NavItem {
	id: NavId;
	label: string;
	icon: string;
	href: string;
	/** Items without a page yet show a "coming soon" toast instead of navigating. */
	ready: boolean;
}

export const navItems: NavItem[] = [
	{ id: 'home', label: 'Home', icon: 'home', href: resolve('/'), ready: true },
	{ id: 'explore', label: 'Explore', icon: 'compass-alt', href: resolve('/explore'), ready: true },
	{ id: 'create', label: 'Create', icon: 'plus', href: resolve('/'), ready: true },
	{ id: 'activity', label: 'Activity', icon: 'heart', href: resolve('/activity'), ready: true },
	{ id: 'saved', label: 'Saved', icon: 'bookmark', href: resolve('/saved'), ready: true },
	{ id: 'profile', label: 'Profile', icon: 'user', href: resolve('/profile'), ready: true }
];

export function activeNavId(pathname: string): NavId | null {
	if (pathname === '/') return 'home';
	if (pathname.startsWith('/profile')) return 'profile';
	if (pathname === '/saved') return 'saved';
	if (pathname === '/explore' || pathname.startsWith('/explore/')) return 'explore';
	if (pathname === '/activity') return 'activity';
	return null;
}

/** Event name the composer listens for when a nav "Create" button is pressed. */
export const OPEN_COMPOSER_EVENT = 'kizuna:open-composer';

/** Nav "Create": the composer lives on Home, so go there first, then ask it to open. */
export async function openComposer(pathname: string): Promise<void> {
	if (pathname !== '/') {
		await goto(resolve('/'));
		// Let the home page mount its composer (and its event listener) before asking it to open.
		await tick();
	}
	window.dispatchEvent(new CustomEvent(OPEN_COMPOSER_EVENT));
}
