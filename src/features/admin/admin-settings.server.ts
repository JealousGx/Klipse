import { getDb } from "@/db"
import { SITE_SETTINGS_ID, siteSettings } from "@/db/schema/site-settings"
import { env } from "@/env"
import { requireAdmin } from "@/features/admin/admin.guard.server"

import type { SiteSettingsData } from "@/features/admin/admin-settings.functions"

// ---------------------------------------------------------------------------
// readSettings — internal helper (no auth required)
// ---------------------------------------------------------------------------

export async function readSettings(): Promise<{
	registrationEnabled: boolean
	registrationEnabledEnv: boolean
}> {
	const [row] = await getDb().select().from(siteSettings).limit(1)
	return {
		// DB flag; default true (open) when no row exists yet
		registrationEnabled: row?.registrationEnabled ?? true,
		// Env override — if env is false, registration is always blocked
		registrationEnabledEnv: env.REGISTRATION_ENABLED,
	}
}

// ---------------------------------------------------------------------------
// getRegistrationStatus — public, no auth
// ---------------------------------------------------------------------------

export async function getRegistrationStatus(): Promise<{
	registrationEnabled: boolean
}> {
	const { registrationEnabled, registrationEnabledEnv } = await readSettings()
	return {
		registrationEnabled: registrationEnabledEnv && registrationEnabled,
	}
}

// ---------------------------------------------------------------------------
// getAdminSettings — protected
// ---------------------------------------------------------------------------

export async function getAdminSettings(
	request: Request,
): Promise<
	{ ok: true; settings: SiteSettingsData } | { ok: false; code: "unauthorized" }
> {
	try {
		await requireAdmin(request)
	} catch {
		return { ok: false, code: "unauthorized" }
	}

	const { registrationEnabled, registrationEnabledEnv } = await readSettings()

	return {
		ok: true,
		settings: {
			registrationEnabled,
			envOverrideActive: !registrationEnabledEnv,
		},
	}
}

// ---------------------------------------------------------------------------
// updateAdminSettings — protected
// ---------------------------------------------------------------------------

export async function updateAdminSettings(
	request: Request,
	registrationEnabled: boolean,
): Promise<{ ok: true } | { ok: false; code: "unauthorized" | "error" }> {
	try {
		await requireAdmin(request)
	} catch {
		return { ok: false, code: "unauthorized" }
	}

	try {
		await getDb()
			.insert(siteSettings)
			.values({
				id: SITE_SETTINGS_ID,
				registrationEnabled,
			})
			.onDuplicateKeyUpdate({
				set: { registrationEnabled },
			})
		return { ok: true }
	} catch {
		return { ok: false, code: "error" }
	}
}
