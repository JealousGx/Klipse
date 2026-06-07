import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { deleteUserAccountFn } from "@/features/user/user-settings.functions"
import { authClient } from "@/lib/auth/client"

export const fieldClass =
	"w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none ring-offset-2 transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

// Re-export PasswordSection from sibling module to keep settings.tsx import clean.
export { PasswordSection } from "./settings-password-section"

// ---------------------------------------------------------------------------
// NotificationRow
// ---------------------------------------------------------------------------

export function NotificationRow({
	label,
	description,
	enabled,
	disabled,
	onToggle,
}: {
	label: string
	description: string
	enabled: boolean
	disabled?: boolean
	onToggle: (value: boolean) => void
}) {
	const id = `notif-${label.replace(/\s+/g, "-").toLowerCase()}`
	return (
		<div className="flex items-start justify-between gap-6">
			<div className="min-w-0">
				<label
					htmlFor={id}
					className="cursor-pointer text-sm font-medium text-foreground"
				>
					{label}
				</label>
				<p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
			</div>
			<button
				id={id}
				role="switch"
				type="button"
				aria-checked={enabled}
				disabled={disabled}
				onClick={() => onToggle(!enabled)}
				className={[
					"relative shrink-0 h-5 w-9 rounded-full border-2 border-transparent transition-colors",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
					"disabled:cursor-not-allowed disabled:opacity-50",
					enabled ? "bg-primary" : "bg-input",
				].join(" ")}
			>
				<span
					className={[
						"pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
						enabled ? "translate-x-4" : "translate-x-0",
					].join(" ")}
				/>
			</button>
		</div>
	)
}

// ---------------------------------------------------------------------------
// DeleteAccountSection
// ---------------------------------------------------------------------------

export function DeleteAccountSection({ email }: { email: string }) {
	const [showConfirm, setShowConfirm] = useState(false)
	const [typedEmail, setTypedEmail] = useState("")
	const [isDeleting, setIsDeleting] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)

	const canDelete = typedEmail.trim().toLowerCase() === email.toLowerCase()

	const handleOpen = useCallback(() => {
		setTypedEmail("")
		setShowConfirm(true)
		requestAnimationFrame(() => inputRef.current?.focus())
	}, [])

	const handleCancel = () => {
		setShowConfirm(false)
		setTypedEmail("")
	}

	const handleDelete = async () => {
		if (!canDelete) return
		setIsDeleting(true)
		try {
			const result = await deleteUserAccountFn()
			if (!result.ok) {
				toast.error(
					result.message ?? "Account deletion failed. Please contact support.",
				)
				setIsDeleting(false)
				return
			}
			toast.success("Your account has been deleted.")
			await authClient.signOut()
			window.location.href = "/"
		} catch {
			toast.error("Something went wrong. Please try again or contact support.")
			setIsDeleting(false)
		}
	}

	if (!showConfirm) {
		return (
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p className="text-sm font-medium text-foreground">Delete account</p>
					<p className="text-xs text-muted-foreground">
						Permanently deletes your account, all videos, channels, and assets.
						This cannot be undone.
					</p>
				</div>
				<Button
					type="button"
					variant="destructive"
					size="sm"
					className="self-start sm:self-auto"
					onClick={handleOpen}
				>
					Delete account
				</Button>
			</div>
		)
	}

	return (
		<div className="space-y-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
			<div>
				<p className="text-sm font-semibold text-destructive">
					This is permanent and irreversible
				</p>
				<p className="mt-1 text-xs text-muted-foreground">
					All your videos, channels, schedule data, and stored files will be
					deleted immediately. Your Polar subscription is not affected — cancel
					it separately if needed.
				</p>
			</div>
			<div className="space-y-2">
				<label
					htmlFor="delete-confirm-email"
					className="text-xs font-medium text-foreground"
				>
					Type your email to confirm:{" "}
					<span className="font-mono text-destructive">{email}</span>
				</label>
				<input
					id="delete-confirm-email"
					ref={inputRef}
					type="email"
					autoComplete="off"
					value={typedEmail}
					onChange={(e) => setTypedEmail(e.target.value)}
					placeholder={email}
					className={fieldClass}
					disabled={isDeleting}
				/>
			</div>
			<div className="flex gap-3">
				<Button
					type="button"
					variant="destructive"
					size="sm"
					disabled={!canDelete || isDeleting}
					onClick={() => void handleDelete()}
				>
					{isDeleting ? "Deleting…" : "Delete my account"}
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					disabled={isDeleting}
					onClick={handleCancel}
				>
					Cancel
				</Button>
			</div>
		</div>
	)
}
