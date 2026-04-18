import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import {
	getAdminSettings,
	getRegistrationStatus,
	updateAdminSettings,
} from "@/features/admin/admin-settings.server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PublicRegistrationStatus = {
	/** Combined: false if either env var or DB flag disables registration. */
	registrationEnabled: boolean;
};

export type SiteSettingsData = {
	registrationEnabled: boolean;
	/** True when the env var is overriding the DB setting off. */
	envOverrideActive: boolean;
};

export type GetAdminSettingsResult =
	| { ok: true; settings: SiteSettingsData }
	| { ok: false; code: "unauthorized" };

export type UpdateAdminSettingsResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "error" };

// ---------------------------------------------------------------------------
// Public — no auth. Used by the auth modal to reflect current state.
// ---------------------------------------------------------------------------

export const getRegistrationStatusFn = createServerFn({
	method: "GET",
}).handler(async (): Promise<PublicRegistrationStatus> => {
	return getRegistrationStatus();
});

// ---------------------------------------------------------------------------
// Admin — protected get/set
// ---------------------------------------------------------------------------

export const getAdminSettingsFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<GetAdminSettingsResult> => {
		return getAdminSettings(getRequest());
	},
);

export const updateAdminSettingsFn = createServerFn({ method: "POST" })
	.inputValidator(z.object({ registrationEnabled: z.boolean() }))
	.handler(async ({ data }): Promise<UpdateAdminSettingsResult> => {
		return updateAdminSettings(getRequest(), data.registrationEnabled);
	});
