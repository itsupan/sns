import { beforeEach, describe, expect, it, vi } from 'vitest';
import { imageSrcset } from './image';

const state = vi.hoisted(() => ({ page: { data: {} as Record<string, unknown> } }));
vi.mock('$app/state', () => state);

beforeEach(() => {
	state.page.data = { imageTransforms: true };
});

describe('imageSrcset', () => {
	it('offers resized copies of our own media at each width', () => {
		expect(imageSrcset('/api/media/posts/u1/a.jpg', [320, 640])).toBe(
			'/cdn-cgi/image/width=320,quality=85,format=auto/api/media/posts/u1/a.jpg 320w, ' +
				'/cdn-cgi/image/width=640,quality=85,format=auto/api/media/posts/u1/a.jpg 640w'
		);
	});

	it('returns nothing while transformations are off', () => {
		state.page.data = { imageTransforms: false };
		expect(imageSrcset('/api/media/posts/u1/a.jpg', [320])).toBeUndefined();
		state.page.data = {};
		expect(imageSrcset('/api/media/posts/u1/a.jpg', [320])).toBeUndefined();
	});

	it('never wraps images served from anywhere else', () => {
		for (const url of [
			'https://images.unsplash.com/photo-1?w=1200',
			'https://acct.r2.cloudflarestorage.com/bucket/posts/u1/a.jpg?X-Amz-Signature=x',
			'//evil.test/api/media/a.jpg',
			'/api/upload/mock-r2/posts/u1/a.jpg',
			''
		]) {
			expect(imageSrcset(url, [320])).toBeUndefined();
		}
	});
});
