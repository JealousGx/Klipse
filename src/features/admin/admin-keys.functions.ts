import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { providerApiKeys } from "@/db/schema/provider-api-keys";

import { requireAdmin } from "@/features/admin/admin.guard.server";
import { secretFingerprint } from "@/features/ai/lib/provider-key-fingerprint.server";

import { providerApiKeyRowId } from "@/lib/id";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Safe projection — never includes the raw `secret`. */
export type AdminKeyRow = {
	id: string;
	provider: string;
	/** Last 8 chars of the SHA-256 fingerprint — enough to identify, not enough to reconstruct. */
	keyHint: string;
	label: string | null;
	modelId: string | null;
	taskType: string;
	sortOrder: number;
	disabled: boolean;
	cooldownUntil: Date | null;
	failureCount: number;
	errorType: string | null;
	ownerEmail: string | null;
	quotaResetAt: Date | null;
	createdAt: Date;
	/** Derived status for display. */
	status: "active" | "disabled" | "cooling";
};

function toAdminKeyRow(row: typeof providerApiKeys.$inferSelect): AdminKeyRow {
	const now = new Date();
	const cooling = Boolean(
		row.cooldownUntil && new Date(row.cooldownUntil) > now,
	);
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
	};
}

// ---------------------------------------------------------------------------
// listAdminKeysFn
// ---------------------------------------------------------------------------

export type ListAdminKeysResult =
	| { ok: true; keys: AdminKeyRow[] }
	| { ok: false; code: "unauthorized" };

export const listAdminKeysFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<ListAdminKeysResult> => {
		const request = getRequest();
		try {
			await requireAdmin(request);
		} catch {
			return { ok: false, code: "unauthorized" };
		}

		const db = getDb();
		const rows = await db
			.select()
			.from(providerApiKeys)
			.orderBy(providerApiKeys.provider, providerApiKeys.sortOrder);

		return { ok: true, keys: rows.map(toAdminKeyRow) };
	},
);

// ---------------------------------------------------------------------------
// addAdminKeyFn
// ---------------------------------------------------------------------------

const addKeyInput = z.object({
	provider: z.enum([
		"openrouter",
		"gemini",
		"google_tts",
		"pollinations",
		"openai",
		"kling",
		"luma",
	]),
	secret: z.string().min(8),
	ownerEmail: z.string().email().optional(),
	sortOrder: z.number().int().min(0).default(0),
	label: z.string().max(128).optional(),
	modelId: z.string().max(255).optional(),
	taskType: z.enum(["any", "script", "image", "tts", "voice"]).default("any"),
});

export type AddAdminKeyResult =
	| { ok: true; key: AdminKeyRow }
	| {
			ok: false;
			code: "unauthorized" | "duplicate" | "validation";
			message?: string;
	  };

export const addAdminKeyFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => addKeyInput.parse(raw))
	.handler(async ({ data }): Promise<AddAdminKeyResult> => {
		const request = getRequest();
		try {
			await requireAdmin(request);
		} catch {
			return { ok: false, code: "unauthorized" };
		}

		const fingerprint = await secretFingerprint(data.secret);
		const db = getDb();

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
			.limit(1);

		if (existing) {
			return {
				ok: false,
				code: "duplicate",
				message: `A key with the same secret already exists for ${data.provider}.`,
			};
		}

		const now = new Date();
		const id = providerApiKeyRowId();
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
		});

		const [inserted] = await db
			.select()
			.from(providerApiKeys)
			.where(eq(providerApiKeys.id, id))
			.limit(1);

		if (!inserted) {
			return { ok: false, code: "validation", message: "Insert failed." };
		}

		return { ok: true, key: toAdminKeyRow(inserted) };
	});

// ---------------------------------------------------------------------------
// updateAdminKeyFn
// ---------------------------------------------------------------------------

const updateKeyInput = z.object({
	id: z.string(),
	label: z.string().max(128).optional(),
	modelId: z.string().max(255).optional(),
	taskType: z.enum(["any", "script", "image", "tts", "voice"]),
	sortOrder: z.number().int().min(0),
	ownerEmail: z.string().email().optional(),
});

export type UpdateAdminKeyResult =
	| { ok: true; key: AdminKeyRow }
	| {
			ok: false;
			code: "unauthorized" | "not_found" | "validation";
			message?: string;
	  };

export const updateAdminKeyFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => updateKeyInput.parse(raw))
	.handler(async ({ data }): Promise<UpdateAdminKeyResult> => {
		const request = getRequest();
		try {
			await requireAdmin(request);
		} catch {
			return { ok: false, code: "unauthorized" };
		}

		const db = getDb();
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
			.where(eq(providerApiKeys.id, data.id));

		if (!result[0].affectedRows) return { ok: false, code: "not_found" };

		const [updated] = await db
			.select()
			.from(providerApiKeys)
			.where(eq(providerApiKeys.id, data.id))
			.limit(1);

		if (!updated) return { ok: false, code: "not_found" };
		return { ok: true, key: toAdminKeyRow(updated) };
	});

// ---------------------------------------------------------------------------
// toggleAdminKeyFn
// ---------------------------------------------------------------------------

export type ToggleAdminKeyResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" };

export const toggleAdminKeyFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) =>
		z.object({ id: z.string(), disabled: z.boolean() }).parse(raw),
	)
	.handler(async ({ data }): Promise<ToggleAdminKeyResult> => {
		const request = getRequest();
		try {
			await requireAdmin(request);
		} catch {
			return { ok: false, code: "unauthorized" };
		}

		const db = getDb();
		const result = await db
			.update(providerApiKeys)
			.set({ disabled: data.disabled, updatedAt: new Date() })
			.where(eq(providerApiKeys.id, data.id));

		if (!result[0].affectedRows) return { ok: false, code: "not_found" };
		return { ok: true };
	});

// ---------------------------------------------------------------------------
// resetAdminKeyCooldownFn
// ---------------------------------------------------------------------------

export type ResetAdminKeyCooldownResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" };

export const resetAdminKeyCooldownFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => z.object({ id: z.string() }).parse(raw))
	.handler(async ({ data }): Promise<ResetAdminKeyCooldownResult> => {
		const request = getRequest();
		try {
			await requireAdmin(request);
		} catch {
			return { ok: false, code: "unauthorized" };
		}

		const db = getDb();
		const result = await db
			.update(providerApiKeys)
			.set({
				cooldownUntil: null,
				failureCount: 0,
				errorType: null,
				lastFailureAt: null,
				updatedAt: new Date(),
			})
			.where(eq(providerApiKeys.id, data.id));

		if (!result[0].affectedRows) return { ok: false, code: "not_found" };
		return { ok: true };
	});

// ---------------------------------------------------------------------------
// deleteAdminKeyFn
// ---------------------------------------------------------------------------

export type DeleteAdminKeyResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" };

export const deleteAdminKeyFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => z.object({ id: z.string() }).parse(raw))
	.handler(async ({ data }): Promise<DeleteAdminKeyResult> => {
		const request = getRequest();
		try {
			await requireAdmin(request);
		} catch {
			return { ok: false, code: "unauthorized" };
		}

		const db = getDb();
		const result = await db
			.delete(providerApiKeys)
			.where(eq(providerApiKeys.id, data.id));

		if (!result[0].affectedRows) return { ok: false, code: "not_found" };
		return { ok: true };
	});
