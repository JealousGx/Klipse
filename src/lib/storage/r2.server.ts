import "@tanstack/react-start/server-only";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/env";
import { getEnvironment } from "@/lib/utils";

/** Shape aligned with S3 `ListObjectsV2` contents when you add listing later. */
export interface FileObject {
	Key?: string;
	LastModified?: Date;
	ETag?: string;
	Size?: number;
	StorageClass?: string;
}

const R2_ACCOUNT_ID = env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = env.R2_BUCKET_NAME;

const S3 = new S3Client({
	region: "auto",
	endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY,
	},
});

/** Prefix object keys by deploy environment (`production` / `qa`) so buckets can be shared safely. */
export function withR2EnvPrefix(key: string): string {
	const trimmed = key.replace(/^\/+/, "");
	return `${getEnvironment()}/${trimmed}`;
}

/** Public URL for a **logical** key (prefix applied). Uses `R2_PUBLIC_BASE_URL`. */
export function publicUrlForLogicalKey(logicalKey: string): string {
	const prefixed = withR2EnvPrefix(logicalKey);
	const base = env.R2_PUBLIC_BASE_URL.replace(/\/$/, "");
	return `${base}/${prefixed}`;
}

/** Same as {@link publicUrlForLogicalKey} — kept for existing call sites. */
export const publicUrlForR2Key = publicUrlForLogicalKey;

export async function getSignedUrlForUpload(
	logicalKey: string,
	contentType: string,
	options?: { expiresIn?: number },
): Promise<{ signedUrl: string; key: string }> {
	const key = withR2EnvPrefix(logicalKey);
	const expiresIn = options?.expiresIn ?? 3600;

	const command = new PutObjectCommand({
		Bucket: R2_BUCKET,
		Key: decodeURIComponent(key),
		ContentType: contentType,
		CacheControl: "public, max-age=3600",
	});

	try {
		const signedUrl = await getSignedUrl(S3, command, { expiresIn });
		return {
			signedUrl,
			key,
		};
	} catch (error) {
		console.error("[r2] Error generating signed URL:", error);
		throw error;
	}
}

export async function deleteFile(logicalKey: string) {
	const key = withR2EnvPrefix(logicalKey);
	const command = new DeleteObjectCommand({
		Bucket: R2_BUCKET,
		Key: decodeURIComponent(key),
	});

	try {
		return await S3.send(command);
	} catch (error) {
		console.error("[r2] Error deleting file:", error);
		throw error;
	}
}

/**
 * Server-side upload. Returns the public object URL (same shape as browser uploads to a presigned URL).
 */
export async function uploadToR2(
	logicalKey: string,
	body: Buffer,
	contentType: string,
): Promise<string> {
	const prefixedKey = withR2EnvPrefix(logicalKey);
	await S3.send(
		new PutObjectCommand({
			Bucket: R2_BUCKET,
			Key: prefixedKey,
			Body: body,
			ContentType: contentType,
			CacheControl: "public, max-age=31536000, immutable",
		}),
	);
	return publicUrlForLogicalKey(logicalKey);
}

/** Narrow helper for video pipeline callers (returns `{ publicUrl }`). */
export async function putVideoToR2(input: {
	key: string;
	body: Buffer;
	contentType?: string;
}): Promise<{ publicUrl: string }> {
	const publicUrl = await uploadToR2(
		input.key,
		input.body,
		input.contentType ?? "video/mp4",
	);
	return { publicUrl };
}

/** Presigned PUT for external encoders (default TTL 15m). */
export async function presignPutVideoToR2(input: {
	key: string;
	contentType: string;
	expiresIn?: number;
}): Promise<{ url: string }> {
	const { signedUrl } = await getSignedUrlForUpload(
		input.key,
		input.contentType,
		{ expiresIn: input.expiresIn ?? 900 },
	);
	return { url: signedUrl };
}
