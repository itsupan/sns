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
	{ id: 'explore', label: 'Explore', icon: 'compass-alt', href: resolve('/'), ready: false },
	{ id: 'create', label: 'Create', icon: 'plus', href: resolve('/'), ready: false },
	{ id: 'activity', label: 'Activity', icon: 'heart', href: resolve('/'), ready: false },
	{ id: 'saved', label: 'Saved', icon: 'bookmark', href: resolve('/'), ready: false },
	{ id: 'profile', label: 'Profile', icon: 'user', href: resolve('/profile'), ready: true }
];

export function activeNavId(pathname: string): NavId | null {
	if (pathname === '/') return 'home';
	if (pathname.startsWith('/profile')) return 'profile';
	return null;
}

/** Event name the composer listens for when a nav "Create" button is pressed. */
export const OPEN_COMPOSER_EVENT = 'kizuna:open-composer';
