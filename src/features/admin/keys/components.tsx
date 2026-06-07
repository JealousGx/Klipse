import { AlertTriangle, Clock, ShieldOff } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { AdminKeyRow } from "@/features/admin/admin-keys.functions"

import {
	PROVIDER_DOT_COLOR,
	PROVIDER_LABEL,
	type Provider,
	fieldClass,
} from "./types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatCooldownUntil(date: Date | null): string {
	if (!date) return ""
	const d = new Date(date)
	return `until ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

export function StatusBadge({
	status,
	cooldownUntil,
}: {
	status: AdminKeyRow["status"]
	cooldownUntil: Date | null
}) {
	if (status === "active") {
		return (
			<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
				<span className="size-1.5 rounded-full bg-emerald-400" />
				Active
			</span>
		)
	}
	if (status === "cooling") {
		return (
			<span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
				<Clock className="size-3" />
				Cooling {formatCooldownUntil(cooldownUntil)}
			</span>
		)
	}
	return (
		<span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-600/50 bg-zinc-700/50 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
			<ShieldOff className="size-3" />
			Disabled
		</span>
	)
}

// ---------------------------------------------------------------------------
// ProviderBadge
// ---------------------------------------------------------------------------

export function ProviderBadge({ provider }: { provider: string }) {
	const dotColor = PROVIDER_DOT_COLOR[provider as Provider] ?? "bg-zinc-400"
	const label = PROVIDER_LABEL[provider as Provider] ?? provider
	return (
		<span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300">
			<span className={`size-2 rounded-full ${dotColor}`} />
			{label}
		</span>
	)
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

export function StatCard({
	label,
	value,
	color,
}: {
	label: string
	value: number
	color: "green" | "amber" | "zinc"
}) {
	const valueClass =
		color === "green"
			? "text-emerald-400"
			: color === "amber"
				? "text-amber-400"
				: "text-zinc-400"

	return (
		<div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
			<p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
				{label}
			</p>
			<p className={`mt-1 text-3xl font-bold ${valueClass}`}>{value}</p>
		</div>
	)
}

// ---------------------------------------------------------------------------
// DeleteDialog
// ---------------------------------------------------------------------------

export function DeleteDialog({
	keyId,
	onClose,
	onConfirm,
	isPending,
}: {
	keyId: string
	onClose: () => void
	onConfirm: (id: string) => void
	isPending: boolean
}) {
	const [confirmText, setConfirmText] = useState("")

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
			<div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
				<div className="mb-4 flex items-start gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-500/15">
						<AlertTriangle className="size-5 text-red-400" />
					</div>
					<div>
						<h2 className="text-base font-semibold text-zinc-100">
							Delete API Key
						</h2>
						<p className="mt-1 text-sm text-zinc-400">
							This action is permanent. The key will be removed from the pool
							immediately.
						</p>
					</div>
				</div>

				<div className="mb-4">
					<label
						htmlFor="confirm-delete"
						className="mb-1.5 block text-xs font-medium text-zinc-400"
					>
						Type <span className="font-mono text-zinc-300">delete</span> to
						confirm
					</label>
					<input
						name="confirm-delete"
						id="confirm-delete"
						className={fieldClass}
						value={confirmText}
						onChange={(e) => setConfirmText(e.target.value)}
						placeholder="delete"
					/>
				</div>

				<div className="flex justify-end gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={onClose}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						size="sm"
						disabled={confirmText !== "delete" || isPending}
						onClick={() => onConfirm(keyId)}
					>
						{isPending ? "Deleting…" : "Delete Key"}
					</Button>
				</div>
			</div>
		</div>
	)
}
