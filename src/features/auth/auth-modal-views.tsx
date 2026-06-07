import { KeyRound, Loader2, Lock, Mail } from "lucide-react"

import { GoogleIcon } from "@/components/icons/google"
import { Button } from "@/components/ui/button"

import { cn } from "@/lib/utils"

export const inputClass =
	"w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none ring-offset-2 transition focus:ring-2 focus:ring-ring"

// Re-export password / forgot views and title helpers from sibling module.
export {
	ForgotResetView,
	ForgotSendView,
	getModalDescription,
	getModalTitle,
	PasswordLoginView,
	PasswordSignupView,
} from "./auth-modal-password-views"

// ---------------------------------------------------------------------------
// SelectView — initial method picker
// ---------------------------------------------------------------------------

export function SelectView({
	defaultView,
	isLoading,
	termsAccepted,
	setTermsAccepted,
	onGoogle,
	onOtpSend,
	onPasswordMethod,
}: {
	defaultView: "signup" | "login"
	isLoading: boolean
	termsAccepted: boolean
	setTermsAccepted: (v: boolean) => void
	onGoogle: () => void
	onOtpSend: () => void
	onPasswordMethod: () => void
}) {
	if (defaultView !== "signup") return null

	return (
		<div className="space-y-3">
			<Button
				type="button"
				className="w-full"
				size="lg"
				onClick={onGoogle}
				variant="outline"
				disabled={isLoading || !termsAccepted}
			>
				{isLoading ? (
					<Loader2 className="size-5 animate-spin" />
				) : (
					<GoogleIcon className="size-5" />
				)}
				Continue with Google
			</Button>

			<div className="flex items-center gap-3 py-1">
				<div className="h-px flex-1 bg-border/60" />
				<span className="text-xs text-muted-foreground">or</span>
				<div className="h-px flex-1 bg-border/60" />
			</div>

			<Button
				type="button"
				className="w-full"
				variant="outline"
				size="lg"
				onClick={onOtpSend}
				disabled={!termsAccepted}
			>
				<Mail size={16} strokeWidth={1.5} />
				Continue with email code
			</Button>

			<Button
				type="button"
				className="w-full"
				variant="outline"
				size="lg"
				onClick={onPasswordMethod}
				disabled={!termsAccepted}
			>
				<Lock size={16} strokeWidth={1.5} />
				Continue with password
			</Button>

			<div className="flex items-start gap-2 pt-1">
				<input
					id="terms-accept"
					type="checkbox"
					checked={termsAccepted}
					onChange={(e) => setTermsAccepted(e.target.checked)}
					className="mt-1 size-4 rounded border-border"
				/>
				<label
					htmlFor="terms-accept"
					className="text-xs leading-relaxed text-muted-foreground"
				>
					I agree to the{" "}
					<a
						href="/terms"
						target="_blank"
						rel="noopener noreferrer"
						className="font-medium text-primary hover:underline"
					>
						Terms of Service
					</a>{" "}
					and{" "}
					<a
						href="/privacy"
						target="_blank"
						rel="noopener noreferrer"
						className="font-medium text-primary hover:underline"
					>
						Privacy Policy
					</a>
				</label>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------
// OtpSendView
// ---------------------------------------------------------------------------

export function OtpSendView({
	email,
	isLoading,
	onEmailChange,
	onSubmit,
}: {
	email: string
	isLoading: boolean
	onEmailChange: (v: string) => void
	onSubmit: (e: React.FormEvent) => void
}) {
	return (
		<form onSubmit={onSubmit} className="space-y-4">
			<div className="space-y-2">
				<label className="text-sm font-medium" htmlFor="otp-email">
					Email address
				</label>
				<input
					id="otp-email"
					type="email"
					placeholder="you@example.com"
					value={email}
					onChange={(e) => onEmailChange(e.target.value)}
					required
					className={inputClass}
					autoComplete="email"
				/>
			</div>
			<button
				type="submit"
				className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-60"
				disabled={isLoading}
			>
				{isLoading ? (
					<>
						<Loader2 size={16} className="animate-spin" />
						Sending code...
					</>
				) : (
					<>
						<Mail size={16} />
						Send code
					</>
				)}
			</button>
		</form>
	)
}

// ---------------------------------------------------------------------------
// OtpVerifyView
// ---------------------------------------------------------------------------

export function OtpVerifyView({
	mode,
	otp,
	name,
	isLoading,
	otpSlotIds,
	otpRefs,
	onNameChange,
	onOtpChange,
	onOtpKeyDown,
	onOtpPaste,
	onSubmit,
	onResend,
}: {
	mode: "signIn" | "signUp"
	otp: string[]
	name: string
	isLoading: boolean
	otpSlotIds: string[]
	otpRefs: React.RefObject<(HTMLInputElement | null)[]>
	onNameChange: (v: string) => void
	onOtpChange: (index: number, value: string) => void
	onOtpKeyDown: (index: number, e: React.KeyboardEvent) => void
	onOtpPaste: (e: React.ClipboardEvent) => void
	onSubmit: (e: React.FormEvent) => void
	onResend: () => void
}) {
	return (
		<form onSubmit={onSubmit} className="space-y-4">
			{mode === "signUp" ? (
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="otp-name">
						Display name
					</label>
					<input
						id="otp-name"
						type="text"
						placeholder="Your name"
						value={name}
						onChange={(e) => onNameChange(e.target.value)}
						className={inputClass}
						autoComplete="name"
					/>
				</div>
			) : null}
			<div className="space-y-3">
				<span className="text-sm font-medium">Verification code</span>
				<div className="flex justify-center gap-2" onPaste={onOtpPaste}>
					{otp.map((digit, i) => (
						<input
							key={otpSlotIds[i]}
							ref={(el) => {
								otpRefs.current[i] = el
							}}
							type="text"
							inputMode="numeric"
							maxLength={1}
							value={digit}
							onChange={(e) => onOtpChange(i, e.target.value)}
							onKeyDown={(e) => onOtpKeyDown(i, e)}
							className={cn(
								"flex size-11 items-center justify-center rounded-xl border border-border/60 bg-muted/20 text-center text-lg font-semibold tabular-nums outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
							)}
						/>
					))}
				</div>
			</div>
			<button
				type="submit"
				className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-60"
				disabled={isLoading || otp.join("").length !== 6}
			>
				{isLoading ? (
					<>
						<Loader2 size={16} className="animate-spin" />
						Verifying...
					</>
				) : (
					<>
						<KeyRound size={16} />
						Verify &amp; sign in
					</>
				)}
			</button>
			<p className="text-center text-sm text-muted-foreground">
				Didn&apos;t receive a code?{" "}
				<button
					type="button"
					onClick={onResend}
					disabled={isLoading}
					className="font-medium text-primary hover:underline disabled:opacity-50"
				>
					Resend
				</button>
			</p>
		</form>
	)
}
