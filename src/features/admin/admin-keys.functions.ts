import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"
import { z } from "zod"

import {
	addAdminKey,
	deleteAdminKey,
	listAdminKeys,
	resetAdminKeyCooldown,
	toggleAdminKey,
	updateAdminKey,
} from "@/features/admin/admin-keys.server"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Safe projection — never includes the raw `secret`. */
export type AdminKeyRow = {
	id: string
	provider: string
	/** Last 8 chars of the SHA-256 fingerprint — enough to identify, not enough to reconstruct. */
	keyHint: string
	label: string | null
	modelId: string | null
	taskType: string
	sortOrder: number
	disabled: boolean
	cooldownUntil: Date | null
	failureCount: number
	errorType: string | null
	ownerEmail: string | null
	quotaResetAt: Date | null
	createdAt: Date
	/** Derived status for display. */
	status: "active" | "disabled" | "cooling"
}

// ---------------------------------------------------------------------------
// listAdminKeysFn
// ---------------------------------------------------------------------------

export type ListAdminKeysResult =
	| { ok: true; keys: AdminKeyRow[] }
	| { ok: false; code: "unauthorized" }

export const listAdminKeysFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<ListAdminKeysResult> => {
		return listAdminKeys(getRequest())
	},
)

// ---------------------------------------------------------------------------
// addAdminKeyFn
// ---------------------------------------------------------------------------

const addKeyInput = z.object({
	provider: z.enum([
		// Active providers
		"openrouter",
		"google_tts",
		"replicate",
		"unreal_speech",
		"elevenlabs",
		// Legacy / reserved
		"gemini",
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
	taskType: z
		.enum(["any", "script", "image", "tts", "voice", "sound"])
		.default("any"),
})

export type AddKeyInput = z.infer<typeof addKeyInput>

export type AddAdminKeyResult =
	| { ok: true; key: AdminKeyRow }
	| {
			ok: false
			code: "unauthorized" | "duplicate" | "validation"
			message?: string
	  }

export const addAdminKeyFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => addKeyInput.parse(raw))
	.handler(async ({ data }): Promise<AddAdminKeyResult> => {
		return addAdminKey(getRequest(), data)
	})

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
})

export type UpdateKeyInput = z.infer<typeof updateKeyInput>

export type UpdateAdminKeyResult =
	| { ok: true; key: AdminKeyRow }
	| {
			ok: false
			code: "unauthorized" | "not_found" | "validation"
			message?: string
	  }

export const updateAdminKeyFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => updateKeyInput.parse(raw))
	.handler(async ({ data }): Promise<UpdateAdminKeyResult> => {
		return updateAdminKey(getRequest(), data)
	})

// ---------------------------------------------------------------------------
// toggleAdminKeyFn
// ---------------------------------------------------------------------------

export type ToggleAdminKeyResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" }

export const toggleAdminKeyFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) =>
		z.object({ id: z.string(), disabled: z.boolean() }).parse(raw),
	)
	.handler(async ({ data }): Promise<ToggleAdminKeyResult> => {
		return toggleAdminKey(getRequest(), data.id, data.disabled)
	})

// ---------------------------------------------------------------------------
// resetAdminKeyCooldownFn
// ---------------------------------------------------------------------------

export type ResetAdminKeyCooldownResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" }

export const resetAdminKeyCooldownFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => z.object({ id: z.string() }).parse(raw))
	.handler(async ({ data }): Promise<ResetAdminKeyCooldownResult> => {
		return resetAdminKeyCooldown(getRequest(), data.id)
	})

// ---------------------------------------------------------------------------
// deleteAdminKeyFn
// ---------------------------------------------------------------------------

export type DeleteAdminKeyResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" }

export const deleteAdminKeyFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => z.object({ id: z.string() }).parse(raw))
	.handler(async ({ data }): Promise<DeleteAdminKeyResult> => {
		return deleteAdminKey(getRequest(), data.id)
	})
