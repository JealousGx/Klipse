import { and, eq } from "drizzle-orm"

import { getDb } from "@/db"
import { providerApiKeys } from "@/db/schema/provider-api-keys"
import { requireAdmin } from "@/features/admin/admin.guard.server"
import type {
	AddKeyInput,
	AdminKeyRow,
	UpdateKeyInput,
} from "@/features/admin/admin-keys.functions"
import { secretFingerprint } from "@/features/ai/lib/provider-key-fingerprint.server"
import { providerApiKeyRowId } from "@/lib/id"

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function toAdminKeyRow(row: typeof providerApiKeys.$inferSelect): AdminKeyRow {
	const now = new Date()
	const cooling = Boolean(
		row.cooldownUntil && new Date(row.cooldownUntil) > now,
	)
	return {
		id: row.id,
		provider: row.provider,
		keyHint: row.secretFingerprint.slice(-8),
		label: row.label ?? null,
		modelId: row.modelId ?? null,
		taskType: row.taskType,
		sortOrder: row.sortOrder,
		disabled: row.disabled,
		cooldownUntil: row.cooldownUntil ?? null,
		failureCount: row.failureCount,
		errorType: row.errorType ?? null,
		ownerEmail: row.ownerEmail ?? null,
		quotaResetAt: row.quotaResetAt ?? null,
		createdAt: row.createdAt,
		status: row.disabled ? "disabled" : cooling ? "cooling" : "active",
	}
}

// ---------------------------------------------------------------------------
// listAdminKeys
// ---------------------------------------------------------------------------

export async function listAdminKeys(
	request: Request,
): Promise<
	{ ok: true; keys: AdminKeyRow[] } | { ok: false; code: "unauthorized" }
> {
	try {
		await requireAdmin(request)
	} catch {
		return { ok: false, code: "unauthorized" }
	}

	const db = getDb()
	const rows = await db
		.select()
		.from(providerApiKeys)
		.orderBy(providerApiKeys.provider, providerApiKeys.sortOrder)

	return { ok: true, keys: rows.map(toAdminKeyRow) }
}

// ---------------------------------------------------------------------------
// addAdminKey
// ---------------------------------------------------------------------------

export async function addAdminKey(
	request: Request,
	data: AddKeyInput,
): Promise<
	| { ok: true; key: AdminKeyRow }
	| {
			ok: false
			code: "unauthorized" | "duplicate" | "validation"
			message?: string
	  }
> {
	try {
		await requireAdmin(request)
	} catch {
		return { ok: false, code: "unauthorized" }
	}

	const fingerprint = await secretFingerprint(data.secret)
	const db = getDb()

	// Duplicate check
	const [existing] = await db
		.select({ id: providerApiKeys.id })
		.from(providerApiKeys)
		.where(
			and(
				eq(providerApiKeys.provider, data.provider),
				eq(providerApiKeys.secretFingerprint, fingerprint),
			),
		)
		.limit(1)

	if (existing) {
		return {
			ok: false,
			code: "duplicate",
			message: `A key with the same secret already exists for ${data.provider}.`,
		}
	}

	const now = new Date()
	const id = providerApiKeyRowId()
	await db.insert(providerApiKeys).values({
		id,
		provider: data.provider,
		secretFingerprint: fingerprint,
		secret: data.secret,
		sortOrder: data.sortOrder,
		disabled: false,
		failureCount: 0,
		ownerEmail: data.ownerEmail ?? null,
		label: data.label ?? null,
		modelId: data.modelId ?? null,
		taskType: data.taskType,
		createdAt: now,
		updatedAt: now,
	})

	const [inserted] = await db
		.select()
		.from(providerApiKeys)
		.where(eq(providerApiKeys.id, id))
		.limit(1)

	if (!inserted) {
		return { ok: false, code: "validation", message: "Insert failed." }
	}

	return { ok: true, key: toAdminKeyRow(inserted) }
}

// ---------------------------------------------------------------------------
// updateAdminKey
// ---------------------------------------------------------------------------

export async function updateAdminKey(
	request: Request,
	data: UpdateKeyInput,
): Promise<
	| { ok: true; key: AdminKeyRow }
	| {
			ok: false
			code: "unauthorized" | "not_found" | "validation"
			message?: string
	  }
> {
	try {
		await requireAdmin(request)
	} catch {
		return { ok: false, code: "unauthorized" }
	}

	const db = getDb()
	const result = await db
		.update(providerApiKeys)
		.set({
			label: data.label?.trim() || null,
			modelId: data.modelId?.trim() || null,
			taskType: data.taskType,
			sortOrder: data.sortOrder,
			ownerEmail: data.ownerEmail?.trim() || null,
			updatedAt: new Date(),
		})
		.where(eq(providerApiKeys.id, data.id))

	if (!result[0].affectedRows) return { ok: false, code: "not_found" }

	const [updated] = await db
		.select()
		.from(providerApiKeys)
		.where(eq(providerApiKeys.id, data.id))
		.limit(1)

	if (!updated) return { ok: false, code: "not_found" }
	return { ok: true, key: toAdminKeyRow(updated) }
}

// ---------------------------------------------------------------------------
// toggleAdminKey
// ---------------------------------------------------------------------------

export async function toggleAdminKey(
	request: Request,
	id: string,
	disabled: boolean,
): Promise<{ ok: true } | { ok: false; code: "unauthorized" | "not_found" }> {
	try {
		await requireAdmin(request)
	} catch {
		return { ok: false, code: "unauthorized" }
	}

	const db = getDb()
	const result = await db
		.update(providerApiKeys)
		.set({ disabled, updatedAt: new Date() })
		.where(eq(providerApiKeys.id, id))

	if (!result[0].affectedRows) return { ok: false, code: "not_found" }
	return { ok: true }
}

// ---------------------------------------------------------------------------
// resetAdminKeyCooldown
// ---------------------------------------------------------------------------

export async function resetAdminKeyCooldown(
	request: Request,
	id: string,
): Promise<{ ok: true } | { ok: false; code: "unauthorized" | "not_found" }> {
	try {
		await requireAdmin(request)
	} catch {
		return { ok: false, code: "unauthorized" }
	}

	const db = getDb()
	const result = await db
		.update(providerApiKeys)
		.set({
			cooldownUntil: null,
			failureCount: 0,
			errorType: null,
			lastFailureAt: null,
			updatedAt: new Date(),
		})
		.where(eq(providerApiKeys.id, id))

	if (!result[0].affectedRows) return { ok: false, code: "not_found" }
	return { ok: true }
}

// ---------------------------------------------------------------------------
// deleteAdminKey
// ---------------------------------------------------------------------------

export async function deleteAdminKey(
	request: Request,
	id: string,
): Promise<{ ok: true } | { ok: false; code: "unauthorized" | "not_found" }> {
	try {
		await requireAdmin(request)
	} catch {
		return { ok: false, code: "unauthorized" }
	}

	const db = getDb()
	const result = await db
		.delete(providerApiKeys)
		.where(eq(providerApiKeys.id, id))

	if (!result[0].affectedRows) return { ok: false, code: "not_found" }
	return { ok: true }
}
