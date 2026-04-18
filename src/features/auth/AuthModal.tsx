import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, Loader2, Lock, Mail } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { GoogleIcon } from "@/components/icons/google";

import { siteConfig } from "@/config/site";

import { env } from "@/env";
import { getRegistrationStatusFn } from "@/features/admin/admin-settings.functions";
import { authClient, signIn, signUp } from "@/lib/auth/client";
import { readBetterAuthActionError } from "@/lib/client-errors";
import { cn } from "@/lib/utils";

import type { AuthModalMode } from "./AuthModalContext";

type AuthMethod =
	| "select"
	| "otp-send"
	| "otp-verify"
	| "password-login"
	| "password-signup"
	| "forgot-send"
	| "forgot-reset";

type AuthModalProps = {
	mode: AuthModalMode;
	onClose: () => void;
};

const inputClass =
	"w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none ring-offset-2 transition focus:ring-2 focus:ring-ring";

export default function AuthModal({ mode, onClose }: AuthModalProps) {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();

	const defaultView = mode === "signUp" ? "signup" : "login";

	// Env var acts as deploy-time kill-switch (false = always closed).
	// DB query reflects admin dashboard toggle in real-time (60s cache).
	const { data: regStatus } = useQuery({
		queryKey: ["registration-status"],
		queryFn: () => getRegistrationStatusFn(),
		staleTime: 60_000,
		// Default to env var value while loading — avoids flicker on re-opens
		placeholderData: { registrationEnabled: env.VITE_REGISTRATION_ENABLED },
	});
	const registrationEnabled =
		regStatus?.registrationEnabled ?? env.VITE_REGISTRATION_ENABLED;

	const [method, setMethod] = useState<AuthMethod>("select");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [name, setName] = useState("");
	const [otp, setOtp] = useState(["", "", "", "", "", ""]);
	const [termsAccepted, setTermsAccepted] = useState(false);

	const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
	const otpSlotIds = useRef(
		Array.from({ length: 6 }, (_, i) => `otp-slot-${i}`),
	).current;

	const resetForm = useCallback(() => {
		setEmail("");
		setPassword("");
		setNewPassword("");
		setConfirmPassword("");
		setName("");
		setOtp(["", "", "", "", "", ""]);
		setTermsAccepted(false);
		setError(null);
		setIsLoading(false);
	}, []);

	useEffect(() => {
		setMethod("select");
		resetForm();
	}, [resetForm]);

	useEffect(() => {
		if (isPending) return;
		if (session?.user) {
			onClose();
		}
	}, [isPending, onClose, session?.user]);

	useEffect(() => {
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, []);

	const navigateTo = (to: AuthMethod) => {
		setError(null);
		setMethod(to);
	};

	const goBack = () => {
		if (method === "otp-verify") {
			setOtp(["", "", "", "", "", ""]);
			navigateTo("otp-send");
		} else if (method === "forgot-reset") {
			setOtp(["", "", "", "", "", ""]);
			navigateTo("forgot-send");
		} else if (method === "forgot-send") {
			navigateTo("password-login");
		} else {
			navigateTo("select");
		}
	};

	const finishAuthSuccess = () => {
		onClose();
		resetForm();
		void navigate({ to: "/dashboard" });
	};

	const handleGoogle = async () => {
		setIsLoading(true);
		setError(null);
		try {
			await signIn.social({
				provider: "google",
				callbackURL: "/dashboard",
			});
		} catch {
			setError("Google sign-in failed. Please try again.");
			setIsLoading(false);
		}
	};

	const handleSendOtp = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError(null);
		try {
			const result = await authClient.emailOtp.sendVerificationOtp({
				email,
				type: "sign-in",
			});
			const msg = readBetterAuthActionError(
				result,
				"Failed to send code. Please try again.",
			);
			if (msg) setError(msg);
			else {
				navigateTo("otp-verify");
				setTimeout(() => otpRefs.current[0]?.focus(), 150);
			}
		} catch {
			setError("Failed to send code. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const handleOtpChange = (index: number, value: string) => {
		if (!/^\d*$/.test(value)) return;
		const next = [...otp];
		next[index] = value.slice(-1);
		setOtp(next);
		if (value && index < 5) {
			otpRefs.current[index + 1]?.focus();
		}
	};

	const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
		if (e.key === "Backspace" && !otp[index] && index > 0) {
			otpRefs.current[index - 1]?.focus();
		}
	};

	const handleOtpPaste = (e: React.ClipboardEvent) => {
		e.preventDefault();
		const pasted = e.clipboardData
			.getData("text")
			.replace(/\D/g, "")
			.slice(0, 6);
		if (!pasted) return;
		const next = [...otp];
		for (let i = 0; i < pasted.length; i++) {
			next[i] = pasted[i] ?? "";
		}
		setOtp(next);
		const focusIdx = Math.min(pasted.length, 5);
		otpRefs.current[focusIdx]?.focus();
	};

	const handleVerifyOtp = async (e: React.FormEvent) => {
		e.preventDefault();
		const code = otp.join("");
		if (code.length !== 6) return;
		setIsLoading(true);
		setError(null);
		try {
			const result = await signIn.emailOtp({
				email,
				otp: code,
				name:
					mode === "signUp"
						? name.trim() ||
							(email.includes("@") ? (email.split("@")[0] ?? "User") : "User")
						: undefined,
			});
			const msg = readBetterAuthActionError(
				result,
				"Invalid code. Please try again.",
			);
			if (msg) setError(msg);
			else finishAuthSuccess();
		} catch {
			setError("Verification failed. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const handleResendOtp = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const result = await authClient.emailOtp.sendVerificationOtp({
				email,
				type: "sign-in",
			});
			const msg = readBetterAuthActionError(result, "Failed to resend code.");
			if (msg) setError(msg);
			else {
				setOtp(["", "", "", "", "", ""]);
				otpRefs.current[0]?.focus();
			}
		} catch {
			setError("Failed to resend code.");
		} finally {
			setIsLoading(false);
		}
	};

	const handleForgotSendOtp = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError(null);
		try {
			const result = await authClient.emailOtp.requestPasswordReset({
				email,
			});
			const msg = readBetterAuthActionError(
				result,
				"Failed to send reset code.",
			);
			if (msg) setError(msg);
			else {
				navigateTo("forgot-reset");
				setTimeout(() => otpRefs.current[0]?.focus(), 150);
			}
		} catch {
			setError("Failed to send reset code. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const handleResetPassword = async (e: React.FormEvent) => {
		e.preventDefault();
		const code = otp.join("");
		if (code.length !== 6) return;
		if (newPassword !== confirmPassword) {
			setError("Passwords do not match.");
			return;
		}
		setIsLoading(true);
		setError(null);
		try {
			const result = await authClient.emailOtp.resetPassword({
				email,
				otp: code,
				password: newPassword,
			});
			const msg = readBetterAuthActionError(
				result,
				"Failed to reset password.",
			);
			if (msg) setError(msg);
			else {
				setError(null);
				navigateTo("password-login");
				resetForm();
			}
		} catch {
			setError("Failed to reset password. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const handlePasswordLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError(null);
		try {
			const result = await signIn.email({ email, password });
			const msg = readBetterAuthActionError(
				result,
				"Invalid email or password.",
			);
			if (msg) setError(msg);
			else finishAuthSuccess();
		} catch {
			setError("Sign in failed. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const handlePasswordSignup = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError(null);
		try {
			const result = await signUp.email({
				name,
				email,
				password,
			});
			const msg = readBetterAuthActionError(
				result,
				"Could not create account.",
			);
			if (msg) setError(msg);
			else finishAuthSuccess();
		} catch {
			setError("Could not create account.");
		} finally {
			setIsLoading(false);
		}
	};

	const title: Record<AuthMethod, string> = {
		select: defaultView === "signup" ? "Create your account" : "Welcome back",
		"otp-send": "Sign in with email",
		"otp-verify": "Check your email",
		"password-login": "Sign in with password",
		"password-signup": "Create your account",
		"forgot-send": "Reset your password",
		"forgot-reset": "Set new password",
	};

	const description: Record<AuthMethod, string> = {
		select: `Continue to ${siteConfig.name}`,
		"otp-send": "We’ll send a 6-digit code to your email",
		"otp-verify": `Enter the code sent to ${email || "your email"}`,
		"password-login": `Sign in to ${siteConfig.name}`,
		"password-signup": `Start using ${siteConfig.name} today`,
		"forgot-send": "We’ll send a reset code to your email",
		"forgot-reset": `Enter the code sent to ${email || "your email"} and your new password`,
	};

	const showBack = method !== "select";

	return (
		<div
			className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4"
			role="dialog"
			aria-modal="true"
			onMouseDown={(e) => {
				if (e.currentTarget === e.target) {
					onClose();
				}
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
					<button
						type="button"
						className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-muted/30"
						onClick={() => onClose()}
						disabled={isLoading}
						aria-label="Close auth modal"
					>
						Close
					</button>
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
						{title[method]}
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						{description[method]}
					</p>
				</div>

				<div className="space-y-4">
					{error ? (
						<div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
							{error}
						</div>
					) : null}

					{method === "select" ? (
						defaultView === "signup" && !registrationEnabled ? (
							<div className="rounded-xl border border-border bg-muted/30 px-5 py-6 text-center">
								<p className="text-sm font-semibold text-foreground">
									Registrations are currently closed
								</p>
								<p className="mt-1.5 text-sm text-muted-foreground">
									New account creation is temporarily disabled. Please check
									back soon.
								</p>
								<button
									type="button"
									className="mt-4 text-sm font-medium text-primary hover:underline"
									onClick={onClose}
								>
									Close
								</button>
							</div>
						) : (
							<div className="space-y-3">
								<button
									type="button"
									className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted/30 disabled:opacity-60"
									onClick={handleGoogle}
									disabled={isLoading || !termsAccepted}
								>
									{isLoading ? (
										<Loader2 className="size-5 animate-spin" />
									) : (
										<GoogleIcon className="size-5" />
									)}
									Continue with Google
								</button>

								<div className="flex items-center gap-3 py-1">
									<div className="h-px flex-1 bg-border/60" />
									<span className="text-xs text-muted-foreground">or</span>
									<div className="h-px flex-1 bg-border/60" />
								</div>

								<button
									type="button"
									className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted/30 disabled:opacity-60"
									onClick={() => navigateTo("otp-send")}
									disabled={!termsAccepted}
								>
									<Mail size={16} strokeWidth={1.5} />
									Continue with email code
								</button>

								<button
									type="button"
									className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted/30 disabled:opacity-60"
									onClick={() =>
										navigateTo(
											defaultView === "signup"
												? "password-signup"
												: "password-login",
										)
									}
									disabled={!termsAccepted}
								>
									<Lock size={16} strokeWidth={1.5} />
									Continue with password
								</button>

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
					) : null}

					{method === "otp-send" ? (
						<form onSubmit={handleSendOtp} className="space-y-4">
							<div className="space-y-2">
								<label className="text-sm font-medium" htmlFor="otp-email">
									Email address
								</label>
								<input
									id="otp-email"
									type="email"
									placeholder="you@example.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
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
					) : null}

					{method === "otp-verify" ? (
						<form onSubmit={handleVerifyOtp} className="space-y-4">
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
										onChange={(e) => setName(e.target.value)}
										className={inputClass}
										autoComplete="name"
									/>
								</div>
							) : null}
							<div className="space-y-3">
								<span className="text-sm font-medium">Verification code</span>
								<div
									className="flex justify-center gap-2"
									onPaste={handleOtpPaste}
								>
									{otp.map((digit, i) => (
										<input
											key={otpSlotIds[i]}
											ref={(el) => {
												otpRefs.current[i] = el;
											}}
											type="text"
											inputMode="numeric"
											maxLength={1}
											value={digit}
											onChange={(e) => handleOtpChange(i, e.target.value)}
											onKeyDown={(e) => handleOtpKeyDown(i, e)}
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
										Verify & sign in
									</>
								)}
							</button>
							<p className="text-center text-sm text-muted-foreground">
								Didn&apos;t receive a code?{" "}
								<button
									type="button"
									onClick={handleResendOtp}
									disabled={isLoading}
									className="font-medium text-primary hover:underline disabled:opacity-50"
								>
									Resend
								</button>
							</p>
						</form>
					) : null}

					{method === "password-login" ? (
						<form onSubmit={handlePasswordLogin} className="space-y-4">
							<div className="space-y-2">
								<label className="text-sm font-medium" htmlFor="pw-email">
									Email
								</label>
								<input
									id="pw-email"
									type="email"
									placeholder="you@example.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
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
										onClick={() => navigateTo("forgot-send")}
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
									onChange={(e) => setPassword(e.target.value)}
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
							{registrationEnabled ? (
								<p className="text-center text-sm text-muted-foreground">
									Don&apos;t have an account?{" "}
									<button
										type="button"
										onClick={() => {
											resetForm();
											navigateTo("password-signup");
										}}
										className="font-medium text-primary hover:underline"
									>
										Sign up
									</button>
								</p>
							) : null}
						</form>
					) : null}

					{method === "password-signup" ? (
						<form onSubmit={handlePasswordSignup} className="space-y-4">
							<div className="space-y-2">
								<label className="text-sm font-medium" htmlFor="su-name">
									Full name
								</label>
								<input
									id="su-name"
									placeholder="John Doe"
									value={name}
									onChange={(e) => setName(e.target.value)}
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
									onChange={(e) => setEmail(e.target.value)}
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
									onChange={(e) => setPassword(e.target.value)}
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
									onClick={() => {
										resetForm();
										navigateTo("password-login");
									}}
									className="font-medium text-primary hover:underline"
								>
									Sign in
								</button>
							</p>
						</form>
					) : null}

					{method === "forgot-send" ? (
						<form onSubmit={handleForgotSendOtp} className="space-y-4">
							<div className="space-y-2">
								<label className="text-sm font-medium" htmlFor="forgot-email">
									Email address
								</label>
								<input
									id="forgot-email"
									type="email"
									placeholder="you@example.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
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
					) : null}

					{method === "forgot-reset" ? (
						<form onSubmit={handleResetPassword} className="space-y-4">
							<div className="space-y-3">
								<span className="text-sm font-medium">Reset code</span>
								<div
									className="flex justify-center gap-2"
									onPaste={handleOtpPaste}
								>
									{otp.map((digit, i) => (
										<input
											key={`forgot-${otpSlotIds[i]}`}
											ref={(el) => {
												otpRefs.current[i] = el;
											}}
											type="text"
											inputMode="numeric"
											maxLength={1}
											value={digit}
											onChange={(e) => handleOtpChange(i, e.target.value)}
											onKeyDown={(e) => handleOtpKeyDown(i, e)}
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
									onChange={(e) => setNewPassword(e.target.value)}
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
									onChange={(e) => setConfirmPassword(e.target.value)}
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
					) : null}
				</div>
			</div>
		</div>
	);
}
