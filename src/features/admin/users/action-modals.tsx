import { useMutation, useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	type AdminUserRow,
	adjustUserCreditsFn,
	changeUserPlanFn,
} from "@/features/admin/admin-user.functions"

import { fieldClass } from "./components"

// ---------------------------------------------------------------------------
// Plan constants (local to action modals)
// ---------------------------------------------------------------------------

const PLANS = ["free", "starter", "creator", "empire"] as const
type Plan = (typeof PLANS)[number]

// ---------------------------------------------------------------------------
// AdjustCreditsModal
// ---------------------------------------------------------------------------

export function AdjustCreditsModal({
	user,
	onClose,
}: {
	user: AdminUserRow
	onClose: () => void
}) {
	const queryClient = useQueryClient()
	const [delta, setDelta] = useState<number>(0)
	const [reason, setReason] = useState("")

	const mutation = useMutation({
		mutationFn: () =>
			adjustUserCreditsFn({ data: { userId: user.id, delta, reason } }),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success(`Credits adjusted. New balance: ${result.newCredits}`)
				queryClient.invalidateQueries({ queryKey: ["admin-users"] })
				onClose()
			} else if (result.code === "below_zero") {
				toast.error("This adjustment would result in negative credits.")
			} else {
				toast.error("Failed to adjust credits.")
			}
		},
		onError: () => toast.error("Failed to adjust credits."),
	})

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
			<div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
				<div className="mb-5 flex items-center justify-between">
					<div>
						<h2 className="text-base font-semibold text-zinc-100">
							Adjust Credits
						</h2>
						<p className="mt-0.5 text-xs text-zinc-400">
							{user.email} — current balance:{" "}
							<span className="font-medium text-zinc-200">
								{user.creditsRemaining}
							</span>
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
					>
						<X className="size-4" />
					</button>
				</div>

				<div className="space-y-4">
					<div>
						<label
							htmlFor="delta"
							className="mb-1.5 block text-xs font-medium text-zinc-400"
						>
							Delta (+ to add, − to subtract)
						</label>
						<input
							id="delta"
							name="delta"
							type="number"
							className={fieldClass}
							value={delta}
							onChange={(e) => setDelta(Number(e.target.value))}
							placeholder="e.g. 100 or -50"
						/>
					</div>
					<div>
						<label
							htmlFor="reason"
							className="mb-1.5 block text-xs font-medium text-zinc-400"
						>
							Reason
						</label>
						<input
							id="reason"
							name="reason"
							className={fieldClass}
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							placeholder="Admin credit adjustment…"
						/>
					</div>
					{delta !== 0 && (
						<p className="text-xs text-zinc-400">
							New balance:{" "}
							<span
								className={`font-medium ${user.creditsRemaining + delta < 0 ? "text-red-400" : "text-zinc-100"}`}
							>
								{user.creditsRemaining + delta}
							</span>
						</p>
					)}
				</div>

				<div className="mt-5 flex justify-end gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={onClose}
						disabled={mutation.isPending}
					>
						Cancel
					</Button>
					<Button
						size="sm"
						disabled={delta === 0 || !reason.trim() || mutation.isPending}
						onClick={() => mutation.mutate()}
					>
						{mutation.isPending ? "Saving…" : "Apply"}
					</Button>
				</div>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------
// ChangePlanModal
// ---------------------------------------------------------------------------

export function ChangePlanModal({
	user,
	onClose,
}: {
	user: AdminUserRow
	onClose: () => void
}) {
	const queryClient = useQueryClient()
	const [plan, setPlan] = useState<Plan>(user.plan as Plan)

	const mutation = useMutation({
		mutationFn: () => changeUserPlanFn({ data: { userId: user.id, plan } }),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success(`Plan changed to ${plan}.`)
				queryClient.invalidateQueries({ queryKey: ["admin-users"] })
				onClose()
			} else {
				toast.error("Failed to change plan.")
			}
		},
		onError: () => toast.error("Failed to change plan."),
	})

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
			<div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
				<div className="mb-5 flex items-center justify-between">
					<div>
						<h2 className="text-base font-semibold text-zinc-100">
							Change Plan
						</h2>
						<p className="mt-0.5 text-xs text-zinc-400">{user.email}</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
					>
						<X className="size-4" />
					</button>
				</div>

				<div className="space-y-4">
					<div>
						<label
							htmlFor="plan"
							className="mb-1.5 block text-xs font-medium text-zinc-400"
						>
							Plan
						</label>

						<Select
							defaultValue={plan}
							onValueChange={(val) => setPlan(val as Plan)}
						>
							<SelectTrigger className="w-55">
								<SelectValue placeholder="Select Plan" />
							</SelectTrigger>
							<SelectContent>
								{PLANS.map((p) => (
									<SelectItem key={p} value={p}>
										{p.charAt(0).toUpperCase() + p.slice(1)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="mt-5 flex justify-end gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={onClose}
						disabled={mutation.isPending}
					>
						Cancel
					</Button>
					<Button
						size="sm"
						disabled={plan === user.plan || mutation.isPending}
						onClick={() => mutation.mutate()}
					>
						{mutation.isPending ? "Saving…" : "Save"}
					</Button>
				</div>
			</div>
		</div>
	)
}
