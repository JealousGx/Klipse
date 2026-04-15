import { withRetries } from "./retry";

const UPLOAD_ATTEMPTS = 4;

/**
 * Uploads a buffer to a presigned PUT URL (R2 or S3-compatible).
 * Retries up to 4 times with exponential backoff.
 */
export async function uploadBufferToPresignedUrl(
	url: string,
	buffer: Buffer | Uint8Array,
	contentType: string,
): Promise<void> {
	await withRetries("r2_upload", UPLOAD_ATTEMPTS, async () => {
		const res = await fetch(url, {
			method: "PUT",
			headers: { "Content-Type": contentType },
			body: buffer instanceof Buffer ? buffer : Buffer.from(buffer),
			signal: AbortSignal.timeout(120_000),
		});
		if (!res.ok) {
			const text = await res.text().catch(() => "");
			throw new Error(`r2_put_${res.status}:${text.slice(0, 500)}`);
		}
	});
}
