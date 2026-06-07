import { ArrowLeft, X } from "lucide-react"

import { Button } from "@/components/ui/button"

import { siteConfig } from "@/config/site"

import type { AuthModalMode } from "./AuthModalContext"
import {
	ForgotResetView,
	ForgotSendView,
	getModalDescription,
	getModalTitle,
	OtpSendView,
	OtpVerifyView,
	PasswordLoginView,
	PasswordSignupView,
	SelectView,
} from "./auth-modal-views"
import { useAuthModal } from "./use-auth-modal"

type AuthModalProps = {
	mode: AuthModalMode
	onClose: () => void
}

export default function AuthModal({ mode, onClose }: AuthModalProps) {
	const {
		method,
		error,
		isLoading,
		email,
		setEmail,
		password,
		setPassword,
		newPassword,
		setNewPassword,
		confirmPassword,
		setConfirmPassword,
		name,
		setName,
		otp,
		termsAccepted,
		setTermsAccepted,
		otpRefs,
		otpSlotIds,
		navigateTo,
		goBack,
		resetForm,
		handleGoogle,
		handleSendOtp,
		handleOtpChange,
		handleOtpKeyDown,
		handleOtpPaste,
		handleVerifyOtp,
		handleResendOtp,
		handleForgotSendOtp,
		handleResetPassword,
		handlePasswordLogin,
		handlePasswordSignup,
	} = useAuthModal(mode, onClose)

	const defaultView = mode === "signUp" ? "signup" : "login"
	const showBack = method !== "select"

	return (
		<div
			className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4"
			role="dialog"
			aria-modal="true"
			onMouseDown={(e) => {
				if (e.currentTarget === e.target) onClose()
			}}
		>
			<div
				role="document"
				className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-lg"
				onMouseDown={(e) => e.stopPropagation()}
			>
				<div className="mb-4 flex items-start justify-between gap-3">
					{showBack ? (
						<button
							type="button"
							onClick={goBack}
							className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							aria-label="Back"
						>
							<ArrowLeft size={16} strokeWidth={1.5} />
						</button>
					) : (
						<span className="w-7" aria-hidden />
					)}
					<Button
						type="button"
						onClick={() => onClose()}
						disabled={isLoading}
						size="icon"
						variant="outline"
						aria-label="Close auth modal"
					>
						<X size={16} strokeWidth={1.5} />
					</Button>
				</div>

				<div className="mb-6 text-center">
					<div className="mx-auto mb-3 flex size-12 items-center justify-center">
						<img
							src="/logo.png"
							alt={siteConfig.name}
							className="size-12 object-contain"
						/>
					</div>
					<h2 className="font-heading text-lg font-semibold tracking-tight">
						{getModalTitle(method, defaultView)}
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						{getModalDescription(method, email)}
					</p>
				</div>

				<div className="space-y-4">
					{error ? (
						<div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
							{error}
						</div>
					) : null}

					{method === "select" ? (
						<SelectView
							defaultView={defaultView}
							isLoading={isLoading}
							termsAccepted={termsAccepted}
							setTermsAccepted={setTermsAccepted}
							onGoogle={handleGoogle}
							onOtpSend={() => navigateTo("otp-send")}
							onPasswordMethod={() =>
								navigateTo(
									defaultView === "signup"
										? "password-signup"
										: "password-login",
								)
							}
						/>
					) : null}

					{method === "otp-send" ? (
						<OtpSendView
							email={email}
							isLoading={isLoading}
							onEmailChange={setEmail}
							onSubmit={handleSendOtp}
						/>
					) : null}

					{method === "otp-verify" ? (
						<OtpVerifyView
							mode={mode === "signUp" ? "signUp" : "signIn"}
							otp={otp}
							name={name}
							isLoading={isLoading}
							otpSlotIds={otpSlotIds}
							otpRefs={otpRefs}
							onNameChange={setName}
							onOtpChange={handleOtpChange}
							onOtpKeyDown={handleOtpKeyDown}
							onOtpPaste={handleOtpPaste}
							onSubmit={handleVerifyOtp}
							onResend={handleResendOtp}
						/>
					) : null}

					{method === "password-login" ? (
						<PasswordLoginView
							email={email}
							password={password}
							isLoading={isLoading}
							onEmailChange={setEmail}
							onPasswordChange={setPassword}
							onForgot={() => navigateTo("forgot-send")}
							onSignUp={() => {
								resetForm()
								navigateTo("password-signup")
							}}
							onSubmit={handlePasswordLogin}
						/>
					) : null}

					{method === "password-signup" ? (
						<PasswordSignupView
							name={name}
							email={email}
							password={password}
							isLoading={isLoading}
							onNameChange={setName}
							onEmailChange={setEmail}
							onPasswordChange={setPassword}
							onSignIn={() => {
								resetForm()
								navigateTo("password-login")
							}}
							onSubmit={handlePasswordSignup}
						/>
					) : null}

					{method === "forgot-send" ? (
						<ForgotSendView
							email={email}
							isLoading={isLoading}
							onEmailChange={setEmail}
							onSubmit={handleForgotSendOtp}
						/>
					) : null}

					{method === "forgot-reset" ? (
						<ForgotResetView
							otp={otp}
							newPassword={newPassword}
							confirmPassword={confirmPassword}
							isLoading={isLoading}
							otpSlotIds={otpSlotIds}
							otpRefs={otpRefs}
							onOtpChange={handleOtpChange}
							onOtpKeyDown={handleOtpKeyDown}
							onOtpPaste={handleOtpPaste}
							onNewPasswordChange={setNewPassword}
							onConfirmPasswordChange={setConfirmPassword}
							onSubmit={handleResetPassword}
						/>
					) : null}
				</div>
			</div>
		</div>
	)
}
