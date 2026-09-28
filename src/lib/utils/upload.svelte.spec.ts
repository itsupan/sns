import { describe, expect, it } from 'vitest';
import { IMAGE_PRESETS, optimizeImage } from './upload';

// Runs in the browser project: real canvas encoding and decoding.

/** A noisy (hard to compress) PNG so re-encoding is never skipped as "not smaller". */
async function photo(width: number, height: number): Promise<File> {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;
	const data = ctx.createImageData(width, height);
	// 32-bit integer hash per byte (plain multiplication would lose precision past 2^53).
	for (let i = 0; i < data.data.length; i++) {
		data.data[i] = i % 4 === 3 ? 255 : Math.imul(i ^ (i >>> 13), 0x5bd1e995) >>> 24;
	}
	ctx.putImageData(data, 0, 0);
	const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'));
	return new File([blob], 'photo.png', { type: 'image/png' });
}

async function dimensions(file: File) {
	const bitmap = await createImageBitmap(file);
	return { width: bitmap.width, height: bitmap.height };
}

async function optimized(file: File, folder: keyof typeof IMAGE_PRESETS) {
	const { maxDimension, quality } = IMAGE_PRESETS[folder];
	return optimizeImage(file, maxDimension, quality);
}

describe('image upload quality', () => {
	it('keeps post photos sharp: long edge up to 2048px, not the 512px avatar size', async () => {
		const out = await optimized(await photo(4000, 3000), 'posts');
		expect(await dimensions(out)).toEqual({ width: 2048, height: 1536 });
		expect(out.type).toBe('image/webp');
	});

	it('sizes stories for a full phone screen (1080x1920)', async () => {
		const out = await optimized(await photo(2160, 3840), 'stories');
		expect(await dimensions(out)).toEqual({ width: 1080, height: 1920 });
	});

	it('still shrinks avatars to 512px', async () => {
		const out = await optimized(await photo(2000, 1000), 'avatars');
		expect(await dimensions(out)).toEqual({ width: 512, height: 256 });
	});

	it('never upscales images that are already small enough', async () => {
		const out = await optimized(await photo(800, 600), 'posts');
		expect(await dimensions(out)).toEqual({ width: 800, height: 600 });
	});
});
