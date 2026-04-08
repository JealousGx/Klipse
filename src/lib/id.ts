import { uuidv7 } from "uuidv7";

/**
 * Prefixed IDs for app-owned rows (channels, jobs, generated assets, etc.). Better Auth
 * continues to assign its own user/session/account ids in the auth tables.
 */
function uuidv7Base64Url() {
	const hex = uuidv7().replace(/-/g, "");
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	let bin = "";
	for (let i = 0; i < bytes.length; i++) {
		const b = bytes[i];
		if (b === undefined) break;
		bin += String.fromCharCode(b);
	}
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function prefixedId(prefix: string) {
	return `${prefix}_${uuidv7Base64Url()}`;
}

const ID_PREFIXES = {
	user: "usr",
	session: "ses",
	account: "acc",
	verification: "vrf",
	profile: "prf",
	analysis: "anl",
	suggestion: "sug",
	rewrite: "rwt",
	subscription: "sub",
	usageLog: "usg",
	providerDailyQuota: "pqd",
	scanJob: "sj",
	/** `channels` PK. */
	channel: "chn",
	/** `jobs` PK. */
	job: "job",
	/** `provider_api_keys` PK (legacy prefix still `rek` for migrated rows). */
	providerKey: "rek",
	/** `user_upload_targets` PK. */
	uploadTarget: "utt",
	/** `platform_accounts` PK (OAuth connections — not Better Auth `account`). */
	oauthPlatform: "oap",
	/** `generated_videos` PK (AI studio output). */
	generatedVideo: "gvi",
	/** `generated_uploads` PK. */
	generatedUpload: "gup",
	creditTransaction: "ctx",
	usageIdempotency: "uim",
	/** `expiring_assets` PK — R2 object tracked for TTL purge. */
	expiringAsset: "sfb",
	/** `schedules` PK — one row per channel driving the automated generation loop. */
	schedule: "sch",
} as const;

export function userId() {
	return prefixedId(ID_PREFIXES.user);
}

export function sessionId() {
	return prefixedId(ID_PREFIXES.session);
}

export function accountId() {
	return prefixedId(ID_PREFIXES.account);
}

export function verificationId() {
	return prefixedId(ID_PREFIXES.verification);
}

export function profileId() {
	return prefixedId(ID_PREFIXES.profile);
}

export function analysisId() {
	return prefixedId(ID_PREFIXES.analysis);
}

export function suggestionId() {
	return prefixedId(ID_PREFIXES.suggestion);
}

export function rewriteId() {
	return prefixedId(ID_PREFIXES.rewrite);
}

export function subscriptionId() {
	return prefixedId(ID_PREFIXES.subscription);
}

export function usageLogId() {
	return prefixedId(ID_PREFIXES.usageLog);
}

export function providerDailyQuotaId() {
	return prefixedId(ID_PREFIXES.providerDailyQuota);
}

export function scanJobId() {
	return prefixedId(ID_PREFIXES.scanJob);
}

/** Drizzle `.$defaultFn(channelRowId)` — `channels` table. */
export function channelRowId() {
	return prefixedId(ID_PREFIXES.channel);
}

/** `jobs` table PK. */
export function jobRowId() {
	return prefixedId(ID_PREFIXES.job);
}

/** `provider_api_keys` table PK. */
export function providerApiKeyRowId() {
	return prefixedId(ID_PREFIXES.providerKey);
}

/** @deprecated Use `providerApiKeyRowId`. */
export function rekaApiKeyRowId() {
	return providerApiKeyRowId();
}

/** `user_upload_targets` table PK. */
export function userUploadTargetRowId() {
	return prefixedId(ID_PREFIXES.uploadTarget);
}

/** `platform_accounts` (OAuth) table PK. */
export function oauthPlatformAccountRowId() {
	return prefixedId(ID_PREFIXES.oauthPlatform);
}

export function generatedVideoRowId() {
	return prefixedId(ID_PREFIXES.generatedVideo);
}

export function generatedUploadRowId() {
	return prefixedId(ID_PREFIXES.generatedUpload);
}

export function creditTransactionId() {
	return prefixedId(ID_PREFIXES.creditTransaction);
}

export function usageIdempotencyRowId() {
	return prefixedId(ID_PREFIXES.usageIdempotency);
}

export function expiringAssetRowId() {
	return prefixedId(ID_PREFIXES.expiringAsset);
}

/** `schedules` table PK. */
export function scheduleRowId() {
	return prefixedId(ID_PREFIXES.schedule);
}
