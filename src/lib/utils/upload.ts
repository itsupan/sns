export interface UploadOptions {
	onProgress?: (percent: number) => void;
	maxSizeMb?: number;
	allowedTypes?: string[];
}

export interface UploadResult {
	uploadUrl: string;
	publicUrl: string;
	key: string;
}

const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

const DEFAULT_MAX_SIZE_MB = 10;

/**
 * Requests a pre-signed URL from the backend for uploading a file to Cloudflare R2.
 */
export async function getPresignedUploadUrl(file: {
	name: string;
	type: string;
	size: number;
}): Promise<UploadResult> {
	const response = await fetch('/api/upload/presigned', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			filename: file.name,
			contentType: file.type || 'application/octet-stream',
			size: file.size
		})
	});

	if (!response.ok) {
		let errorMessage = `Failed to get presigned upload URL (${response.status})`;
		try {
			const data = (await response.json()) as { error?: string };
			if (data && typeof data.error === 'string') {
				errorMessage = data.error;
			}
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
		onProgress
	} = options;

	// Validate file type
	if (allowedTypes.length > 0 && file.type && !allowedTypes.includes(file.type)) {
		throw new Error(`Invalid file type "${file.type}". Allowed types: ${allowedTypes.join(', ')}`);
	}

	// Validate file size
	const maxSizeBytes = maxSizeMb * 1024 * 1024;
	if (file.size > maxSizeBytes) {
		throw new Error(`File size exceeds maximum allowed limit of ${maxSizeMb}MB`);
	}

	// Step 1: Request pre-signed URL from backend
	const presigned = await getPresignedUploadUrl(file);

	// Step 2: Perform direct PUT request to Cloudflare R2
	if (typeof XMLHttpRequest !== 'undefined' && onProgress) {
		await new Promise<void>((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open('PUT', presigned.uploadUrl);
			xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

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

			xhr.send(file);
		});
	} else {
		const putResponse = await fetch(presigned.uploadUrl, {
			method: 'PUT',
			headers: {
				'Content-Type': file.type || 'application/octet-stream'
			},
			body: file
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
