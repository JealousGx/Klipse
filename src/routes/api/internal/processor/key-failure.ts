import { createFileRoute } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { getDb } from "@/db"
import { providerApiKeys } from "@/db/schema/provider-api-keys"
import { recordProviderKeyFailure } from "@/features/ai/lib/provider-api-key-state.server"
import { ProviderHttpError } from "@/features/ai/lib/provider-http-error.server"
import { classifyProviderHttpFailure } from "@/features/ai/lib/provider-key-failure-classify.server"
import { parseRetryAfterHeader } from "@/features/ai/lib/provider-quota-reset-parse.server"
import { videoProcessorAuthMiddleware } from "@/middleware/server-route-auth"

const bodySchema = z.object({
	jobId: z.string().trim().min(1).max(64),
	provider: z.enum(["openrouter", "gemini"]),
	keyId: z.string().trim().min(1).max(64),
	httpStatus: z.number().int().min(100).max(599),
	bodySnippet: z.string().max(800).default(""),
	retryAfterHeader: z.string().max(128).nullable().default(null),
})

/** Processor → app: a provider key failed; update DB cooldown for future requests. */
export const Route = createFileRoute("/api/internal/processor/key-failure")({
	server: {
		middleware: [videoProcessorAuthMiddleware],
		handlers: {
			POST: async ({ request }) => {
				const raw: unknown = await request.json().catch(() => null)
				const parsed = bodySchema.safeParse(raw)
				if (!parsed.success) {
					return Response.json(
						{ ok: false as const, error: "invalid_body" },
						{ status: 400 },
					)
				}

				const { keyId, httpStatus, bodySnippet, retryAfterHeader, provider } =
					parsed.data

				const [key] = await getDb()
					.select({
						id: providerApiKeys.id,
						provider: providerApiKeys.provider,
						quotaResetAt: providerApiKeys.quotaResetAt,
					})
					.from(providerApiKeys)
					.where(eq(providerApiKeys.id, keyId))
					.limit(1)

				if (!key)
					return Response.json({ ok: true as const, skipped: "key_not_found" })

				// Guard against provider mismatch — a wrong provider string would apply
				// incorrect cooldown/quotaReset logic.
				if (key.provider !== provider) {
					return Response.json(
						{ ok: false as const, error: "provider_mismatch" },
						{ status: 400 },
					)
				}

				const retryAfterAt = parseRetryAfterHeader(retryAfterHeader)
				const err = new ProviderHttpError(
					httpStatus,
					bodySnippet,
					provider,
					undefined,
					retryAfterAt ?? undefined,
				)

				const classified = classifyProviderHttpFailure(err, {
					quotaResetAt: key.quotaResetAt,
				})
				if (classified.rotate) {
					await recordProviderKeyFailure(
						{
							id: key.id,
							secret: "",
							provider: key.provider,
							quotaResetAt: key.quotaResetAt,
							modelId: null,
						},
						{
							cooldownUntil: classified.cooldownUntil,
							errorType: classified.errorType,
							persistQuotaResetAt: classified.persistQuotaResetAt,
						},
					)
				}

				return Response.json({ ok: true as const })
			},
		},
	},
})
