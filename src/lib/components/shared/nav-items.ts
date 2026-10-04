import { tick } from 'svelte';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { m } from '$lib/i18n';
import type { IconName } from './icons';

export type NavId = 'home' | 'explore' | 'create' | 'activity' | 'saved' | 'profile';

export interface NavItem {
	id: NavId;
	label: string;
	icon: IconName;
	href: string;
}

export const navItems: NavItem[] = [
	{ id: 'home', label: m.nav_home(), icon: 'home', href: resolve('/') },
	{ id: 'explore', label: m.nav_explore(), icon: 'compass-alt', href: resolve('/explore') },
	{ id: 'create', label: m.nav_create(), icon: 'plus', href: resolve('/') },
	{ id: 'activity', label: m.nav_activity(), icon: 'heart', href: resolve('/activity') },
	{ id: 'saved', label: m.nav_saved(), icon: 'bookmark', href: resolve('/saved') },
	{ id: 'profile', label: m.nav_profile(), icon: 'user', href: resolve('/profile') }
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
