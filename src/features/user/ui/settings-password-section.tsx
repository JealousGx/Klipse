import { useQuery } from "@tanstack/react-query"
import { Eye, EyeOff, KeyRound } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { hasPasswordAccountFn } from "@/features/user/user-settings.functions"
import { authClient } from "@/lib/auth/client"

import { fieldClass } from "./settings-sections"

// ---------------------------------------------------------------------------
// PasswordSection
// ---------------------------------------------------------------------------

export function PasswordSection({ email }: { email: string }) {
	const { data, isPending } = useQuery({
		queryKey: ["has-password-account"],
		queryFn: async () => {
			const r = await hasPasswordAccountFn()
			if (!r.ok) throw new Error("unauthorized")
			return r
		},
		staleTime: 5 * 60 * 1_000,
	})

	if (isPending) {
		return (
			<p className="text-sm text-muted-foreground">Loading security info…</p>
		)
	}

	return data?.hasPassword ? (
		<ChangePasswordForm />
	) : (
		<SetPasswordForm email={email} />
	)
}

// ── Change password (user already has one) ──────────────────────────────────

function ChangePasswordForm() {
	const [currentPassword, setCurrentPassword] = useState("")
	const [newPassword, setNewPassword] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("")
	const [showCurrent, setShowCurrent] = useState(false)
	const [showNew, setShowNew] = useState(false)
	const [isSaving, setIsSaving] = useState(false)

	const isValid =
		currentPassword.length > 0 &&
		newPassword.length >= 8 &&
		newPassword === confirmPassword

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!isValid) return
		setIsSaving(true)
		try {
			const result = await authClient.changePassword({
				currentPassword,
				newPassword,
				revokeOtherSessions: true,
			})
			if (result.error) {
				toast.error(result.error.message ?? "Could not change password.")
				return
			}
			toast.success("Password changed. Other sessions have been signed out.")
			setCurrentPassword("")
			setNewPassword("")
			setConfirmPassword("")
		} catch {
			toast.error("Something went wrong. Please try again.")
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
			<div className="flex items-center gap-2 text-sm font-medium text-foreground">
				<KeyRound className="size-4 text-muted-foreground" />
				Change password
			</div>
			<div className="space-y-2">
				<label htmlFor="current-pw" className="text-sm text-muted-foreground">
					Current password
				</label>
				<div className="relative">
					<input
						id="current-pw"
						type={showCurrent ? "text" : "password"}
						autoComplete="current-password"
						value={currentPassword}
						onChange={(e) => setCurrentPassword(e.target.value)}
						className={fieldClass}
						disabled={isSaving}
						required
					/>
					<button
						type="button"
						className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						onClick={() => setShowCurrent((v) => !v)}
						tabIndex={-1}
						aria-label={showCurrent ? "Hide password" : "Show password"}
					>
						{showCurrent ? (
							<EyeOff className="size-4" />
						) : (
							<Eye className="size-4" />
						)}
					</button>
				</div>
			</div>
			<div className="space-y-2">
				<label htmlFor="new-pw" className="text-sm text-muted-foreground">
					New password
					<span className="ml-1 text-xs text-muted-foreground/70">
						(min. 8 characters)
					</span>
				</label>
				<div className="relative">
					<input
						id="new-pw"
						type={showNew ? "text" : "password"}
						autoComplete="new-password"
						value={newPassword}
						onChange={(e) => setNewPassword(e.target.value)}
						minLength={8}
						className={fieldClass}
						disabled={isSaving}
						required
					/>
					<button
						type="button"
						className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						onClick={() => setShowNew((v) => !v)}
						tabIndex={-1}
						aria-label={showNew ? "Hide password" : "Show password"}
					>
						{showNew ? (
							<EyeOff className="size-4" />
						) : (
							<Eye className="size-4" />
						)}
					</button>
				</div>
			</div>
			<div className="space-y-2">
				<label htmlFor="confirm-pw" className="text-sm text-muted-foreground">
					Confirm new password
				</label>
				<input
					id="confirm-pw"
					type="password"
					autoComplete="new-password"
					value={confirmPassword}
					onChange={(e) => setConfirmPassword(e.target.value)}
					className={fieldClass}
					disabled={isSaving}
					required
				/>
				{confirmPassword.length > 0 && newPassword !== confirmPassword && (
					<p className="text-xs text-destructive">Passwords do not match.</p>
				)}
			</div>
			<p className="text-xs text-muted-foreground">
				Changing your password signs out all other active sessions.
			</p>
			<Button type="submit" size="sm" disabled={!isValid || isSaving}>
				{isSaving ? "Saving…" : "Change password"}
			</Button>
		</form>
	)
}

// ── Set password (user signed up via Google / OTP, no password yet) ─────────

type SetPasswordStep = "idle" | "otp-sent" | "saving"

function SetPasswordForm({ email }: { email: string }) {
	const [step, setStep] = useState<SetPasswordStep>("idle")
	const [otp, setOtp] = useState("")
	const [newPassword, setNewPassword] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("")
	const [showNew, setShowNew] = useState(false)
	const [isBusy, setIsBusy] = useState(false)
	const otpRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		if (step === "otp-sent") otpRef.current?.focus()
	}, [step])

	const isValid =
		otp.length === 6 &&
		newPassword.length >= 8 &&
		newPassword === confirmPassword

	const handleSendCode = async () => {
		setIsBusy(true)
		try {
			const result = await authClient.emailOtp.sendVerificationOtp({
				email,
				type: "forget-password",
			})
			if (result.error) {
				toast.error(result.error.message ?? "Could not send code.")
				return
			}
			setStep("otp-sent")
			toast.success(`Verification code sent to ${email}`)
		} catch {
			toast.error("Something went wrong. Please try again.")
		} finally {
			setIsBusy(false)
		}
	}

	const handleSetPassword = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!isValid) return
		setIsBusy(true)
		try {
			const result = await authClient.emailOtp.resetPassword({
				email,
				otp,
				password: newPassword,
			})
			if (result.error) {
				toast.error(result.error.message ?? "Could not set password.")
				return
			}
			toast.success("Password set. You can now sign in with email + password.")
			setStep("idle")
			setOtp("")
			setNewPassword("")
			setConfirmPassword("")
		} catch {
			toast.error("Something went wrong. Please try again.")
		} finally {
			setIsBusy(false)
		}
	}

	if (step === "idle") {
		return (
			<div className="space-y-3">
				<div className="flex items-center gap-2 text-sm font-medium text-foreground">
					<KeyRound className="size-4 text-muted-foreground" />
					Set a password
				</div>
				<p className="text-sm text-muted-foreground">
					You currently sign in via Google or email code. Add a password as an
					extra sign-in method — it won't affect your existing sign-in options.
				</p>
				<Button
					type="button"
					size="sm"
					variant="outline"
					disabled={isBusy}
					onClick={() => void handleSendCode()}
				>
					{isBusy ? "Sending…" : "Send verification code"}
				</Button>
			</div>
		)
	}

	return (
		<form className="space-y-4" onSubmit={(e) => void handleSetPassword(e)}>
			<div className="flex items-center gap-2 text-sm font-medium text-foreground">
				<KeyRound className="size-4 text-muted-foreground" />
				Set a password
			</div>
			<p className="text-sm text-muted-foreground">
				A 6-digit code was sent to{" "}
				<span className="font-medium text-foreground">{email}</span>. Enter it
				below along with your new password.
			</p>
			<div className="space-y-2">
				<label htmlFor="set-otp" className="text-sm text-muted-foreground">
					Verification code
				</label>
				<input
					id="set-otp"
					ref={otpRef}
					type="text"
					inputMode="numeric"
					pattern="[0-9]{6}"
					maxLength={6}
					autoComplete="one-time-code"
					value={otp}
					onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
					className={fieldClass}
					disabled={isBusy}
					required
				/>
			</div>
			<div className="space-y-2">
				<label htmlFor="set-new-pw" className="text-sm text-muted-foreground">
					New password
					<span className="ml-1 text-xs text-muted-foreground/70">
						(min. 8 characters)
					</span>
				</label>
				<div className="relative">
					<input
						id="set-new-pw"
						type={showNew ? "text" : "password"}
						autoComplete="new-password"
						value={newPassword}
						onChange={(e) => setNewPassword(e.target.value)}
						minLength={8}
						className={fieldClass}
						disabled={isBusy}
						required
					/>
					<button
						type="button"
						className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						onClick={() => setShowNew((v) => !v)}
						tabIndex={-1}
						aria-label={showNew ? "Hide password" : "Show password"}
					>
						{showNew ? (
							<EyeOff className="size-4" />
						) : (
							<Eye className="size-4" />
						)}
					</button>
				</div>
			</div>
			<div className="space-y-2">
				<label
					htmlFor="set-confirm-pw"
					className="text-sm text-muted-foreground"
				>
					Confirm new password
				</label>
				<input
					id="set-confirm-pw"
					type="password"
					autoComplete="new-password"
					value={confirmPassword}
					onChange={(e) => setConfirmPassword(e.target.value)}
					className={fieldClass}
					disabled={isBusy}
					required
				/>
				{confirmPassword.length > 0 && newPassword !== confirmPassword && (
					<p className="text-xs text-destructive">Passwords do not match.</p>
				)}
			</div>
			<div className="flex gap-3">
				<Button type="submit" size="sm" disabled={!isValid || isBusy}>
					{isBusy ? "Setting…" : "Set password"}
				</Button>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					disabled={isBusy}
					onClick={() => void handleSendCode()}
				>
					Resend code
				</Button>
			</div>
		</form>
	)
}
