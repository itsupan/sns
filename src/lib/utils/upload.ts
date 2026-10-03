import { m } from '$lib/i18n';
import { readApiError } from './api-error';
export interface UploadOptions {
	onProgress?: (percent: number) => void;
	maxSizeMb?: number;
	allowedTypes?: string[];
	optimize?: boolean;
	/** R2 folder for the object key; defaults to 'avatars' on the server. */
	folder?: UploadFolder;
}

export type UploadFolder = 'avatars' | 'posts' | 'stories';

export interface UploadResult {
	uploadUrl: string;
	publicUrl: string;
	key: string;
}

const DEFAULT_ALLOWED_TYPES = [
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
	'image/avif',
	'video/mp4',
	'video/webm',
	'video/quicktime'
];

const DEFAULT_MAX_SIZE_MB = 50;

/**
 * Resize/quality per upload folder, sized for how the image is displayed on a 2x screen:
 * - avatars: shown at most ~112px, so 512px is plenty and keeps them tiny.
 * - posts: the feed card is up to 672px wide (1344px at 2x); 2048px also covers the lightbox.
 * - stories: full screen 9:16, i.e. 1080x1920 on most phones.
 */
export const IMAGE_PRESETS: Record<UploadFolder, { maxDimension: number; quality: number }> = {
	avatars: { maxDimension: 512, quality: 0.85 },
	posts: { maxDimension: 2048, quality: 0.9 },
	stories: { maxDimension: 1920, quality: 0.9 }
};

/**
 * Downscales and compresses an image on a client-side canvas before uploading (WebP).
 * Images already within `maxDimension` keep their size and are only re-encoded, and the
 * original file is kept whenever re-encoding would not make it smaller.
 */
export async function optimizeImage(
	file: File,
	maxDimension = IMAGE_PRESETS.avatars.maxDimension,
	quality = IMAGE_PRESETS.avatars.quality
): Promise<File> {
	if (
		!file.type.startsWith('image/') ||
		file.type === 'image/gif' ||
		file.type === 'image/svg+xml'
	) {
		return file;
	}

	if (typeof window === 'undefined' || typeof document === 'undefined') {
		return file;
	}

	return new Promise((resolve) => {
		const img = new Image();
		const objectUrl = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(objectUrl);

			let width = img.width;
			let height = img.height;

			if (width > maxDimension || height > maxDimension) {
				if (width > height) {
					height = Math.round((height * maxDimension) / width);
					width = maxDimension;
				} else {
					width = Math.round((width * maxDimension) / height);
					height = maxDimension;
				}
			}

			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;

			const ctx = canvas.getContext('2d');
			if (!ctx) {
				resolve(file);
				return;
			}

			// Smooth, high-quality downscaling (default 'low' makes large photos look soft/jagged).
			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = 'high';
			ctx.drawImage(img, 0, 0, width, height);

			const outputFormat = 'image/webp';
			canvas.toBlob(
				(blob) => {
					if (!blob || blob.size >= file.size) {
						resolve(file);
					} else {
						const optimized = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
							type: outputFormat,
							lastModified: Date.now()
						});
						resolve(optimized);
					}
				},
				outputFormat,
				quality
			);
		};

		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			resolve(file);
		};

		img.src = objectUrl;
	});
}

/** Avatar preset of {@link optimizeImage}; kept for existing callers. */
export function optimizeAvatarImage(file: File): Promise<File> {
	return optimizeImage(file, IMAGE_PRESETS.avatars.maxDimension, IMAGE_PRESETS.avatars.quality);
}

/**
 * Requests a pre-signed URL from the backend for uploading a file to Cloudflare R2.
 */
export async function getPresignedUploadUrl(
	file: {
		name: string;
		type: string;
		size: number;
	},
	folder?: UploadFolder
): Promise<UploadResult> {
	const response = await fetch('/api/upload/presigned', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			filename: file.name,
			contentType: file.type || 'application/octet-stream',
			size: file.size,
			folder
		})
	});

	if (!response.ok) {
		let errorMessage = m.upload_presign_failed(response.status);
		try {
			errorMessage = readApiError(await response.json(), errorMessage).message;
		} catch {
			// ignore json parsing errors
		}
		throw new Error(errorMessage);
	}

	return (await response.json()) as UploadResult;
}

/**
 * File upload utility that requests a pre-signed URL from the backend and performs
 * a PUT request directly to Cloudflare R2.
 *
 * @param file The File object to upload
 * @param options Upload options including progress callback and constraints
 * @returns UploadResult containing the public URL and R2 object key
 */
export async function uploadToR2(file: File, options: UploadOptions = {}): Promise<UploadResult> {
	const {
		maxSizeMb = DEFAULT_MAX_SIZE_MB,
		allowedTypes = DEFAULT_ALLOWED_TYPES,
		optimize = true,
		onProgress,
		folder
	} = options;

	// Validate original file type
	if (allowedTypes.length > 0 && file.type && !allowedTypes.includes(file.type)) {
		throw new Error(m.upload_invalid_type(file.type, allowedTypes.join(', ')));
	}

	// Validate original file size
	const maxSizeBytes = maxSizeMb * 1024 * 1024;
	if (file.size > maxSizeBytes) {
		throw new Error(m.upload_too_large(maxSizeMb));
	}

	// Step 1: Resize/compress for where the image will be shown (see IMAGE_PRESETS).
	const preset = IMAGE_PRESETS[folder ?? 'avatars'];
	const fileToUpload = optimize
		? await optimizeImage(file, preset.maxDimension, preset.quality)
		: file;

	// Step 2: Request pre-signed URL from backend
	const presigned = await getPresignedUploadUrl(fileToUpload, folder);

	// Step 3: Perform direct PUT request to Cloudflare R2
	if (typeof XMLHttpRequest !== 'undefined' && onProgress) {
		await new Promise<void>((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open('PUT', presigned.uploadUrl);
			xhr.setRequestHeader('Content-Type', fileToUpload.type || 'application/octet-stream');

			xhr.upload.onprogress = (event) => {
				if (event.lengthComputable && event.total > 0) {
					const percent = Math.round((event.loaded / event.total) * 100);
					onProgress(Math.min(99, percent));
				}
			};

			xhr.onload = () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					onProgress(100);
					resolve();
				} else {
					reject(new Error(m.upload_failed(xhr.status, xhr.statusText)));
				}
			};

			xhr.onerror = () => reject(new Error(m.upload_network_error()));
			xhr.onabort = () => reject(new Error(m.upload_aborted()));

			xhr.send(fileToUpload);
		});
	} else {
		const putResponse = await fetch(presigned.uploadUrl, {
			method: 'PUT',
			headers: {
				'Content-Type': fileToUpload.type || 'application/octet-stream'
			},
			body: fileToUpload
		});

		if (!putResponse.ok) {
			throw new Error(m.upload_failed(putResponse.status, putResponse.statusText));
		}

		onProgress?.(100);
	}

	return presigned;
}
