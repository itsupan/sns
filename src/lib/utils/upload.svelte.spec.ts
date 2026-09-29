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
	// One xorshift32 step per pixel, written as a whole RGBA word with alpha forced opaque:
	// 4x fewer iterations than per-byte noise, which kept this spec near its timeout under load.
	const pixels = new Uint32Array(data.data.buffer);
	let state = 0x9e3779b9;
	for (let i = 0; i < pixels.length; i++) {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		pixels[i] = state | 0xff000000;
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

// Real canvas encodes of multi-megapixel images: allow for a busy CI machine.
describe('image upload quality', { timeout: 30_000 }, () => {
	it('keeps post photos sharp: long edge up to 2048px, not the 512px avatar size', async () => {
		const out = await optimized(await photo(2560, 1920), 'posts');
		expect(await dimensions(out)).toEqual({ width: 2048, height: 1536 });
		expect(out.type).toBe('image/webp');
	});

	it('sizes stories for a full phone screen (1080x1920)', async () => {
		const out = await optimized(await photo(1350, 2400), 'stories');
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
