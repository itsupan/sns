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
 * Downscales and compresses an image on a client-side canvas before uploading.
 * Reduces 5MB-15MB camera photos to crisp ~40-80KB WebP files, making upload 100x faster.
 */
export async function optimizeAvatarImage(
	file: File,
	maxDimension = 512,
	quality = 0.85
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
		let errorMessage = `Failed to get presigned upload URL (${response.status})`;
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
		throw new Error(`Invalid file type "${file.type}". Allowed types: ${allowedTypes.join(', ')}`);
	}

	// Validate original file size
	const maxSizeBytes = maxSizeMb * 1024 * 1024;
	if (file.size > maxSizeBytes) {
		throw new Error(`File size exceeds maximum allowed limit of ${maxSizeMb}MB`);
	}

	// Step 1: Optimize/compress avatar if enabled (converts large photos to fast, lightweight files)
	const fileToUpload = optimize ? await optimizeAvatarImage(file) : file;

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
					reject(
						new Error(
							`Direct R2 upload failed with status ${xhr.status}: ${xhr.statusText || 'Upload Error'}`
						)
					);
				}
			};

			xhr.onerror = () => reject(new Error('Network error during direct upload to Cloudflare R2'));
			xhr.onabort = () => reject(new Error('Upload was aborted'));

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
			throw new Error(
				`Direct R2 upload failed with status ${putResponse.status}: ${putResponse.statusText || 'Upload Error'}`
			);
		}

		onProgress?.(100);
	}

	return presigned;
}
