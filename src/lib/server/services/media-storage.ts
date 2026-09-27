// In-memory buffer store for mock uploaded files during local dev / testing
export const mockStorage = new Map<string, { buffer: ArrayBuffer; contentType: string }>();

/**
 * Infers the MIME Content-Type based on the object key file extension.
 */
export function inferContentType(key: string, fallback = 'application/octet-stream'): string {
	const ext = key.split('.').pop()?.toLowerCase();
	switch (ext) {
		case 'mp4':
			return 'video/mp4';
		case 'webm':
			return 'video/webm';
		case 'mov':
			return 'video/quicktime';
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'png':
			return 'image/png';
		case 'webp':
			return 'image/webp';
		case 'gif':
			return 'image/gif';
		case 'svg':
			return 'image/svg+xml';
		case 'avif':
			return 'image/avif';
		default:
			return fallback;
	}
}

/**
 * Parses HTTP Range headers into numeric byte boundaries for RFC 206 Partial Content streaming.
 */
export function parseRange(
	rangeHeader: string | null,
	totalSize: number
): { start: number; end: number } | null | 'invalid' {
	if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
		return null;
	}

	const parts = rangeHeader.slice('bytes='.length).split(',')[0].trim().split('-');
	if (parts.length !== 2) {
		return 'invalid';
	}

	const [rawStart, rawEnd] = parts;
	let start: number;
	let end: number;

	if (rawStart === '' && rawEnd === '') {
		return 'invalid';
	}

	if (rawStart === '') {
		// Suffix byte range: bytes=-500 (last 500 bytes)
		const suffixLength = parseInt(rawEnd, 10);
		if (isNaN(suffixLength) || suffixLength <= 0) return 'invalid';
		start = Math.max(0, totalSize - suffixLength);
		end = totalSize - 1;
	} else {
		start = parseInt(rawStart, 10);
		if (isNaN(start) || start < 0 || start >= totalSize) return 'invalid';

		if (rawEnd === '') {
			end = totalSize - 1;
		} else {
			end = parseInt(rawEnd, 10);
			if (isNaN(end) || end < start) return 'invalid';
			end = Math.min(end, totalSize - 1);
		}
	}

	return { start, end };
}
