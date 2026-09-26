export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'kizuna-theme';

class ThemeManager {
	theme = $state<Theme>('system');
	isDark = $state(false);
	initialized = $state(false);

	private mediaQuery: MediaQueryList | null = null;

	init() {
		if (typeof window === 'undefined' || this.initialized) return;

		const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
		if (stored === 'light' || stored === 'dark' || stored === 'system') {
			this.theme = stored;
		} else {
			this.theme = 'system';
		}

		this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		this.mediaQuery.addEventListener('change', () => {
			if (this.theme === 'system') {
				this.applyTheme();
			}
		});

		this.applyTheme();
		this.initialized = true;
	}

	setTheme(newTheme: Theme) {
		this.theme = newTheme;
		if (typeof window !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, newTheme);
			this.applyTheme();
		}
	}

	toggleTheme() {
		// Cycles between light and dark
		if (this.isDark) {
			this.setTheme('light');
		} else {
			this.setTheme('dark');
		}
	}

	private applyTheme() {
		if (typeof document === 'undefined') return;

		const prefersDark = this.mediaQuery ? this.mediaQuery.matches : false;
		const darkActive = this.theme === 'dark' || (this.theme === 'system' && prefersDark);

		this.isDark = darkActive;

		if (darkActive) {
			document.documentElement.classList.add('dark');
			document.documentElement.setAttribute('data-theme', 'dark');
		} else {
			document.documentElement.classList.remove('dark');
			document.documentElement.setAttribute('data-theme', 'light');
		}
	}
}

export const themeManager = new ThemeManager();
