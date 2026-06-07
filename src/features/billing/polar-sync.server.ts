import "@tanstack/react-start/server-only"

import { OrderBillingReason } from "@polar-sh/sdk/models/components/orderbillingreason"
import type { WebhookOrderPaidPayload } from "@polar-sh/sdk/models/components/webhookorderpaidpayload"
import type { WebhookSubscriptionActivePayload } from "@polar-sh/sdk/models/components/webhooksubscriptionactivepayload"
import type { WebhookSubscriptionRevokedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionrevokedpayload"
import { eq, sql } from "drizzle-orm"

import { getDb } from "@/db"
import { creditTransactions, users } from "@/db/schema"

import { resetDestinationReplacementsUsedForUser } from "@/features/channels/destination-replacement-quota.server"

import { creditTransactionId } from "@/lib/id"

import { captureException } from "@/lib/sentry"
import {
	type AppPlan,
	monthlyCreditsForPlan,
	polarProductToCreditAddon,
	polarProductToPlan,
} from "./polar-product-map"

function resolveUserIdFromExternalId(
	externalId: string | null | undefined,
): string | null {
	if (!externalId || externalId.trim() === "") {
		return null
	}
	return externalId
}

async function grantCreditsAndOptionallySetPlan(input: {
	userId: string
	amount: number
	plan?: AppPlan
	metadata: Record<string, unknown>
}) {
	const db = getDb()
	await db.transaction(async (tx) => {
		if (input.plan) {
			await tx
				.update(users)
				.set({
					plan: input.plan,
					creditsRemaining: sql`${users.creditsRemaining} + ${input.amount}`,
					updatedAt: new Date(),
				})
				.where(eq(users.id, input.userId))
		} else {
			await tx
				.update(users)
				.set({
					creditsRemaining: sql`${users.creditsRemaining} + ${input.amount}`,
					updatedAt: new Date(),
				})
				.where(eq(users.id, input.userId))
		}

		await tx.insert(creditTransactions).values({
			id: creditTransactionId(),
			userId: input.userId,
			type: "purchase",
			amount: input.amount,
			metadata: input.metadata,
		})
	})
}

async function setPlanFree(userId: string) {
	const db = getDb()
	await db
		.update(users)
		.set({
			plan: "free",
			destinationReplacementsUsed: 0,
			updatedAt: new Date(),
		})
		.where(eq(users.id, userId))
}

/** New or recovered subscription — set tier and grant first period credits (FEATURE_DOC §10.3). */
export async function handlePolarSubscriptionActive(
	payload: WebhookSubscriptionActivePayload,
) {
	const userId = resolveUserIdFromExternalId(payload.data.customer.externalId)
	if (!userId) {
		captureException(
			new Error("polar_subscription_active: missing externalId"),
			{ subscriptionId: payload.data.id, productId: payload.data.productId },
		)
		return
	}

	const plan = polarProductToPlan(payload.data.productId)
	if (!plan) {
		captureException(
			new Error("polar_subscription_active: unknown productId"),
			{ userId, productId: payload.data.productId },
		)
		return
	}

	const credits = monthlyCreditsForPlan(plan)
	await grantCreditsAndOptionallySetPlan({
		userId,
		amount: credits,
		plan,
		metadata: {
			source: "polar",
			kind: "subscription_active",
			subscriptionId: payload.data.id,
			productId: payload.data.productId,
		},
	})
	await resetDestinationReplacementsUsedForUser(userId)
}

/**
 * Recurring billing and one-time packs. Avoid duplicating the first period (handled by subscription.active).
 */
export async function handlePolarOrderPaid(payload: WebhookOrderPaidPayload) {
	const order = payload.data
	const userId = resolveUserIdFromExternalId(order.customer.externalId)
	if (!userId) {
		return
	}

	const reason = order.billingReason

	if (
		reason === OrderBillingReason.SubscriptionCreate ||
		reason === OrderBillingReason.SubscriptionUpdate
	) {
		return
	}

	if (reason === OrderBillingReason.SubscriptionCycle) {
		const plan = polarProductToPlan(order.productId ?? "")
		if (!plan) {
			return
		}
		const credits = monthlyCreditsForPlan(plan)
		await grantCreditsAndOptionallySetPlan({
			userId,
			amount: credits,
			plan,
			metadata: {
				source: "polar",
				kind: "subscription_cycle",
				orderId: order.id,
				productId: order.productId,
			},
		})
		await resetDestinationReplacementsUsedForUser(userId)
		return
	}

	if (reason === OrderBillingReason.Purchase) {
		const pack = polarProductToCreditAddon(order.productId ?? "")
		if (pack != null) {
			await grantCreditsAndOptionallySetPlan({
				userId,
				amount: pack,
				metadata: {
					source: "polar",
					kind: "credit_pack",
					orderId: order.id,
					productId: order.productId,
				},
			})
		}
	}
}

export async function handlePolarSubscriptionRevoked(
	payload: WebhookSubscriptionRevokedPayload,
) {
	const userId = resolveUserIdFromExternalId(payload.data.customer.externalId)
	if (!userId) {
		captureException(
			new Error("polar_subscription_revoked: missing externalId"),
			{ subscriptionId: payload.data.id },
		)
		return
	}
	await setPlanFree(userId)
}
