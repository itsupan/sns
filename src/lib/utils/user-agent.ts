import { m } from '$lib/i18n';

// Checked in order: Chromium-based browsers also claim Chrome, and nearly all of them Safari.
const BROWSERS: Array<[RegExp, string]> = [
	[/\bEdg(e|A|iOS)?\//, 'Edge'],
	[/\bOPR\//, 'Opera'],
	[/\bSamsungBrowser\//, 'Samsung Internet'],
	[/\b(Firefox|FxiOS)\//, 'Firefox'],
	[/\b(Chrome|CriOS)\//, 'Chrome'],
	[/\bSafari\//, 'Safari']
];

// Mobile platforms first: their user agents also mention Linux or Mac OS X.
const PLATFORMS: Array<[RegExp, string]> = [
	[/\biPhone\b/, 'iPhone'],
	[/\biPad\b/, 'iPad'],
	[/\bAndroid\b/, 'Android'],
	[/\bCrOS\b/, 'ChromeOS'],
	[/\bWindows\b/, 'Windows'],
	[/\bMac OS X\b/, 'macOS'],
	[/\bLinux\b/, 'Linux']
];

/** A short label for the device behind a `User-Agent` header, e.g. "Chrome on macOS". */
export function describeUserAgent(userAgent: string | null): string {
	if (!userAgent) return m.settings_unknown_device();
	const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
	const platform = PLATFORMS.find(([pattern]) => pattern.test(userAgent))?.[1];
	if (browser && platform) return m.settings_device(browser, platform);
	return browser ?? platform ?? m.settings_unknown_device();
}
