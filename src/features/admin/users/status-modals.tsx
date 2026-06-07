import { useMutation, useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
	type AdminUserRow,
	banUserFn,
	createUserFn,
} from "@/features/admin/admin-user.functions"

import { fieldClass } from "./components"

// ---------------------------------------------------------------------------
// BanModal
// ---------------------------------------------------------------------------

export function BanModal({
	user,
	onClose,
}: {
	user: AdminUserRow
	onClose: () => void
}) {
	const queryClient = useQueryClient()
	const [reason, setReason] = useState("")

	const mutation = useMutation({
		mutationFn: () =>
			banUserFn({
				data: { userId: user.id, reason: reason.trim() || undefined },
			}),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success("User banned.")
				queryClient.invalidateQueries({ queryKey: ["admin-users"] })
				onClose()
			} else if (result.code === "cannot_ban_admin") {
				toast.error("Cannot ban another admin.")
			} else {
				toast.error("Failed to ban user.")
			}
		},
		onError: () => toast.error("Failed to ban user."),
	})

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
			<div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
				<div className="mb-5 flex items-center justify-between">
					<div>
						<h2 className="text-base font-semibold text-zinc-100">Ban User</h2>
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

				<div>
					<label
						htmlFor="ban-reason"
						className="mb-1.5 block text-xs font-medium text-zinc-400"
					>
						Reason <span className="text-zinc-600">(optional)</span>
					</label>
					<input
						id="ban-reason"
						name="ban-reason"
						className={fieldClass}
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						placeholder="Violation of terms…"
					/>
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
						variant="destructive"
						size="sm"
						disabled={mutation.isPending}
						onClick={() => mutation.mutate()}
					>
						{mutation.isPending ? "Banning…" : "Ban User"}
					</Button>
				</div>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------
// InviteUserModal
// ---------------------------------------------------------------------------

export function InviteUserModal({ onClose }: { onClose: () => void }) {
	const queryClient = useQueryClient()
	const [email, setEmail] = useState("")
	const [name, setName] = useState("")

	const mutation = useMutation({
		mutationFn: () =>
			createUserFn({ data: { email: email.trim(), name: name.trim() } }),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success("User created — Invitation email sent.")
				queryClient.invalidateQueries({ queryKey: ["admin-users"] })
				onClose()
			} else if (result.code === "email_taken") {
				toast.error("An account with this email already exists.")
			} else {
				toast.error("Failed to create user. Please try again.")
			}
		},
		onError: () => toast.error("Failed to create user. Please try again."),
	})

	const canSubmit =
		email.trim().length > 0 &&
		email.includes("@") &&
		name.trim().length > 0 &&
		!mutation.isPending

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
			<div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
				<div className="mb-5 flex items-center justify-between">
					<div>
						<h2 className="text-base font-semibold text-zinc-100">
							Invite User
						</h2>
						<p className="mt-0.5 text-xs text-zinc-400">
							Creates an account and sends an invite email with a sign-in link.
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
							htmlFor="invite-name"
							className="mb-1.5 block text-xs font-medium text-zinc-400"
						>
							Full name
						</label>
						<input
							id="invite-name"
							name="invite-name"
							className={fieldClass}
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Jane Smith"
						/>
					</div>
					<div>
						<label
							htmlFor="invite-email"
							className="mb-1.5 block text-xs font-medium text-zinc-400"
						>
							Email address
						</label>
						<input
							id="invite-email"
							name="invite-email"
							type="email"
							className={fieldClass}
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="jane@example.com"
						/>
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
						disabled={!canSubmit}
						onClick={() => mutation.mutate()}
					>
						{mutation.isPending ? "Sending invite…" : "Send invite"}
					</Button>
				</div>
			</div>
		</div>
	)
}
