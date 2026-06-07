import { Loader2, Lock, Mail } from "lucide-react"

import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"

import { inputClass } from "./auth-modal-views"

type AuthMethod =
	| "select"
	| "otp-send"
	| "otp-verify"
	| "password-login"
	| "password-signup"
	| "forgot-send"
	| "forgot-reset"

// ---------------------------------------------------------------------------
// PasswordLoginView
// ---------------------------------------------------------------------------

export function PasswordLoginView({
	email,
	password,
	isLoading,
	onEmailChange,
	onPasswordChange,
	onForgot,
	onSignUp,
	onSubmit,
}: {
	email: string
	password: string
	isLoading: boolean
	onEmailChange: (v: string) => void
	onPasswordChange: (v: string) => void
	onForgot: () => void
	onSignUp: () => void
	onSubmit: (e: React.FormEvent) => void
}) {
	return (
		<form onSubmit={onSubmit} className="space-y-4">
			<div className="space-y-2">
				<label className="text-sm font-medium" htmlFor="pw-email">
					Email
				</label>
				<input
					id="pw-email"
					type="email"
					placeholder="you@example.com"
					value={email}
					onChange={(e) => onEmailChange(e.target.value)}
					required
					className={inputClass}
					autoComplete="email"
				/>
			</div>
			<div className="space-y-2">
				<div className="flex items-center justify-between gap-2">
					<label className="text-sm font-medium" htmlFor="pw-password">
						Password
					</label>
					<button
						type="button"
						onClick={onForgot}
						className="text-xs font-medium text-primary hover:underline"
					>
						Forgot password?
					</button>
				</div>
				<input
					id="pw-password"
					type="password"
					placeholder="••••••••"
					value={password}
					onChange={(e) => onPasswordChange(e.target.value)}
					required
					minLength={8}
					className={inputClass}
					autoComplete="current-password"
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
						Signing in...
					</>
				) : (
					"Sign in"
				)}
			</button>
			<p className="text-center text-sm text-muted-foreground">
				Don&apos;t have an account?{" "}
				<button
					type="button"
					onClick={onSignUp}
					className="font-medium text-primary hover:underline"
				>
					Sign up
				</button>
			</p>
		</form>
	)
}

// ---------------------------------------------------------------------------
// PasswordSignupView
// ---------------------------------------------------------------------------

export function PasswordSignupView({
	name,
	email,
	password,
	isLoading,
	onNameChange,
	onEmailChange,
	onPasswordChange,
	onSignIn,
	onSubmit,
}: {
	name: string
	email: string
	password: string
	isLoading: boolean
	onNameChange: (v: string) => void
	onEmailChange: (v: string) => void
	onPasswordChange: (v: string) => void
	onSignIn: () => void
	onSubmit: (e: React.FormEvent) => void
}) {
	return (
		<form onSubmit={onSubmit} className="space-y-4">
			<div className="space-y-2">
				<label className="text-sm font-medium" htmlFor="su-name">
					Full name
				</label>
				<input
					id="su-name"
					placeholder="John Doe"
					value={name}
					onChange={(e) => onNameChange(e.target.value)}
					required
					className={inputClass}
					autoComplete="name"
				/>
			</div>
			<div className="space-y-2">
				<label className="text-sm font-medium" htmlFor="su-email">
					Email
				</label>
				<input
					id="su-email"
					type="email"
					placeholder="you@example.com"
					value={email}
					onChange={(e) => onEmailChange(e.target.value)}
					required
					className={inputClass}
					autoComplete="email"
				/>
			</div>
			<div className="space-y-2">
				<label className="text-sm font-medium" htmlFor="su-password">
					Password
				</label>
				<input
					id="su-password"
					type="password"
					placeholder="••••••••"
					value={password}
					onChange={(e) => onPasswordChange(e.target.value)}
					required
					minLength={8}
					className={inputClass}
					autoComplete="new-password"
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
						Creating account...
					</>
				) : (
					"Create account"
				)}
			</button>
			<p className="text-center text-sm text-muted-foreground">
				Already have an account?{" "}
				<button
					type="button"
					onClick={onSignIn}
					className="font-medium text-primary hover:underline"
				>
					Sign in
				</button>
			</p>
		</form>
	)
}

// ---------------------------------------------------------------------------
// ForgotSendView
// ---------------------------------------------------------------------------

export function ForgotSendView({
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
				<label className="text-sm font-medium" htmlFor="forgot-email">
					Email address
				</label>
				<input
					id="forgot-email"
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
						Send reset code
					</>
				)}
			</button>
		</form>
	)
}

// ---------------------------------------------------------------------------
// ForgotResetView
// ---------------------------------------------------------------------------

export function ForgotResetView({
	otp,
	newPassword,
	confirmPassword,
	isLoading,
	otpSlotIds,
	otpRefs,
	onOtpChange,
	onOtpKeyDown,
	onOtpPaste,
	onNewPasswordChange,
	onConfirmPasswordChange,
	onSubmit,
}: {
	otp: string[]
	newPassword: string
	confirmPassword: string
	isLoading: boolean
	otpSlotIds: string[]
	otpRefs: React.RefObject<(HTMLInputElement | null)[]>
	onOtpChange: (index: number, value: string) => void
	onOtpKeyDown: (index: number, e: React.KeyboardEvent) => void
	onOtpPaste: (e: React.ClipboardEvent) => void
	onNewPasswordChange: (v: string) => void
	onConfirmPasswordChange: (v: string) => void
	onSubmit: (e: React.FormEvent) => void
}) {
	return (
		<form onSubmit={onSubmit} className="space-y-4">
			<div className="space-y-3">
				<span className="text-sm font-medium">Reset code</span>
				<div className="flex justify-center gap-2" onPaste={onOtpPaste}>
					{otp.map((digit, i) => (
						<input
							key={`forgot-${otpSlotIds[i]}`}
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
			<div className="space-y-2">
				<label className="text-sm font-medium" htmlFor="new-pw">
					New password
				</label>
				<input
					id="new-pw"
					type="password"
					placeholder="••••••••"
					value={newPassword}
					onChange={(e) => onNewPasswordChange(e.target.value)}
					required
					minLength={8}
					className={inputClass}
					autoComplete="new-password"
				/>
			</div>
			<div className="space-y-2">
				<label className="text-sm font-medium" htmlFor="confirm-pw">
					Confirm password
				</label>
				<input
					id="confirm-pw"
					type="password"
					placeholder="••••••••"
					value={confirmPassword}
					onChange={(e) => onConfirmPasswordChange(e.target.value)}
					required
					minLength={8}
					className={inputClass}
					autoComplete="new-password"
				/>
			</div>
			<button
				type="submit"
				className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-60"
				disabled={isLoading || otp.join("").length !== 6}
			>
				{isLoading ? (
					<>
						<Loader2 size={16} className="animate-spin" />
						Resetting...
					</>
				) : (
					<>
						<Lock size={16} />
						Reset password
					</>
				)}
			</button>
		</form>
	)
}

// ---------------------------------------------------------------------------
// Modal title / description maps
// ---------------------------------------------------------------------------

export function getModalTitle(
	method: AuthMethod,
	defaultView: "signup" | "login",
): string {
	const title: Record<AuthMethod, string> = {
		select: defaultView === "signup" ? "Create your account" : "Welcome back",
		"otp-send": "Sign in with email",
		"otp-verify": "Check your email",
		"password-login": "Sign in with password",
		"password-signup": "Create your account",
		"forgot-send": "Reset your password",
		"forgot-reset": "Set new password",
	}
	return title[method]
}

export function getModalDescription(method: AuthMethod, email: string): string {
	const description: Record<AuthMethod, string> = {
		select: `Continue to ${siteConfig.name}`,
		"otp-send": "We'll send a 6-digit code to your email",
		"otp-verify": `Enter the code sent to ${email || "your email"}`,
		"password-login": `Sign in to ${siteConfig.name}`,
		"password-signup": `Start using ${siteConfig.name} today`,
		"forgot-send": "We'll send a reset code to your email",
		"forgot-reset": `Enter the code sent to ${email || "your email"} and your new password`,
	}
	return description[method]
}
