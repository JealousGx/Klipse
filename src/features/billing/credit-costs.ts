/**
 * Internal credit costs per operation (FEATURE_DOC §10.2).
 * Use these when deducting DB credits and when setting `metadata.credits` on Polar `klipse.usage` ingests
 * so the meter **Sum** matches your app.
 */
export const CREDIT_COSTS = {
	scriptGeneration: 5,
	/** Per image asset. */
	imagePerImage: 2,
	/** Per 1000 characters of TTS. */
	ttsPer1000Chars: 4,
	videoAssembly: 3,
	/** Per second of AI-generated video. */
	aiVideoPerSecond: 3,
} as const;

export function creditsForTtsChars(charCount: number): number {
	if (charCount <= 0) {
		return 0;
	}
	const units = Math.ceil(charCount / 1000);
	return units * CREDIT_COSTS.ttsPer1000Chars;
}

export function creditsForAiVideoSeconds(seconds: number): number {
	if (seconds <= 0) {
		return 0;
	}
	return Math.ceil(seconds) * CREDIT_COSTS.aiVideoPerSecond;
}

export function creditsForImages(imageCount: number): number {
	if (imageCount <= 0) {
		return 0;
	}
	return imageCount * CREDIT_COSTS.imagePerImage;
}
