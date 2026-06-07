import { useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"

import { authClient, signIn, signUp } from "@/lib/auth/client"
import { readBetterAuthActionError } from "@/lib/client-errors"

import type { AuthModalMode } from "./AuthModalContext"

type AuthMethod =
	| "select"
	| "otp-send"
	| "otp-verify"
	| "password-login"
	| "password-signup"
	| "forgot-send"
	| "forgot-reset"

export function useAuthModal(mode: AuthModalMode, onClose: () => void) {
	const navigate = useNavigate()
	const { data: session, isPending } = authClient.useSession()
	const [method, setMethod] = useState<AuthMethod>("select")
	const [error, setError] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [newPassword, setNewPassword] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("")
	const [name, setName] = useState("")
	const [otp, setOtp] = useState(["", "", "", "", "", ""])
	const [termsAccepted, setTermsAccepted] = useState(false)
	const otpRefs = useRef<(HTMLInputElement | null)[]>([])
	const otpSlotIds = useRef(
		Array.from({ length: 6 }, (_, i) => `otp-slot-${i}`),
	).current

	const resetForm = useCallback(() => {
		setEmail("")
		setPassword("")
		setNewPassword("")
		setConfirmPassword("")
		setName("")
		setOtp(["", "", "", "", "", ""])
		setTermsAccepted(false)
		setError(null)
		setIsLoading(false)
	}, [])

	useEffect(() => {
		setMethod("select")
		resetForm()
	}, [resetForm])
	useEffect(() => {
		if (isPending) return
		if (session?.user) onClose()
	}, [isPending, onClose, session?.user])
	useEffect(() => {
		const prev = document.body.style.overflow
		document.body.style.overflow = "hidden"
		return () => {
			document.body.style.overflow = prev
		}
	}, [])

	const navigateTo = (to: AuthMethod) => {
		setError(null)
		setMethod(to)
	}
	const goBack = () => {
		if (method === "otp-verify") {
			setOtp(["", "", "", "", "", ""])
			navigateTo("otp-send")
		} else if (method === "forgot-reset") {
			setOtp(["", "", "", "", "", ""])
			navigateTo("forgot-send")
		} else if (method === "forgot-send") navigateTo("password-login")
		else navigateTo("select")
	}
	const finishAuthSuccess = () => {
		onClose()
		resetForm()
		void navigate({ to: "/dashboard" })
	}

	async function handleGoogle() {
		setIsLoading(true)
		setError(null)
		try {
			await signIn.social({ provider: "google", callbackURL: "/dashboard" })
		} catch {
			setError("Google sign-in failed. Please try again.")
			setIsLoading(false)
		}
	}

	async function handleSendOtp(e: React.FormEvent) {
		e.preventDefault()
		setIsLoading(true)
		setError(null)
		try {
			const result = await authClient.emailOtp.sendVerificationOtp({
				email,
				type: "sign-in",
			})
			const msg = readBetterAuthActionError(
				result,
				"Failed to send code. Please try again.",
			)
			if (msg) setError(msg)
			else {
				navigateTo("otp-verify")
				setTimeout(() => otpRefs.current[0]?.focus(), 150)
			}
		} catch {
			setError("Failed to send code. Please try again.")
		} finally {
			setIsLoading(false)
		}
	}

	const handleOtpChange = (index: number, value: string) => {
		if (!/^\d*$/.test(value)) return
		const next = [...otp]
		next[index] = value.slice(-1)
		setOtp(next)
		if (value && index < 5) otpRefs.current[index + 1]?.focus()
	}
	const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
		if (e.key === "Backspace" && !otp[index] && index > 0)
			otpRefs.current[index - 1]?.focus()
	}
	const handleOtpPaste = (e: React.ClipboardEvent) => {
		e.preventDefault()
		const pasted = e.clipboardData
			.getData("text")
			.replace(/\D/g, "")
			.slice(0, 6)
		if (!pasted) return
		const next = [...otp]
		for (let i = 0; i < pasted.length; i++) next[i] = pasted[i] ?? ""
		setOtp(next)
		otpRefs.current[Math.min(pasted.length, 5)]?.focus()
	}

	async function handleVerifyOtp(e: React.FormEvent) {
		e.preventDefault()
		const code = otp.join("")
		if (code.length !== 6) return
		setIsLoading(true)
		setError(null)
		try {
			const result = await signIn.emailOtp({
				email,
				otp: code,
				name:
					mode === "signUp"
						? name.trim() ||
							(email.includes("@") ? (email.split("@")[0] ?? "User") : "User")
						: undefined,
			})
			const msg = readBetterAuthActionError(
				result,
				"Invalid code. Please try again.",
			)
			if (msg) setError(msg)
			else finishAuthSuccess()
		} catch {
			setError("Verification failed. Please try again.")
		} finally {
			setIsLoading(false)
		}
	}

	async function handleResendOtp() {
		setIsLoading(true)
		setError(null)
		try {
			const result = await authClient.emailOtp.sendVerificationOtp({
				email,
				type: "sign-in",
			})
			const msg = readBetterAuthActionError(result, "Failed to resend code.")
			if (msg) setError(msg)
			else {
				setOtp(["", "", "", "", "", ""])
				otpRefs.current[0]?.focus()
			}
		} catch {
			setError("Failed to resend code.")
		} finally {
			setIsLoading(false)
		}
	}

	async function handleForgotSendOtp(e: React.FormEvent) {
		e.preventDefault()
		setIsLoading(true)
		setError(null)
		try {
			const result = await authClient.emailOtp.requestPasswordReset({ email })
			const msg = readBetterAuthActionError(
				result,
				"Failed to send reset code.",
			)
			if (msg) setError(msg)
			else {
				navigateTo("forgot-reset")
				setTimeout(() => otpRefs.current[0]?.focus(), 150)
			}
		} catch {
			setError("Failed to send reset code. Please try again.")
		} finally {
			setIsLoading(false)
		}
	}

	async function handleResetPassword(e: React.FormEvent) {
		e.preventDefault()
		const code = otp.join("")
		if (code.length !== 6) return
		if (newPassword !== confirmPassword) {
			setError("Passwords do not match.")
			return
		}
		setIsLoading(true)
		setError(null)
		try {
			const result = await authClient.emailOtp.resetPassword({
				email,
				otp: code,
				password: newPassword,
			})
			const msg = readBetterAuthActionError(result, "Failed to reset password.")
			if (msg) setError(msg)
			else {
				setError(null)
				navigateTo("password-login")
				resetForm()
			}
		} catch {
			setError("Failed to reset password. Please try again.")
		} finally {
			setIsLoading(false)
		}
	}

	async function handlePasswordLogin(e: React.FormEvent) {
		e.preventDefault()
		setIsLoading(true)
		setError(null)
		try {
			const result = await signIn.email({ email, password })
			const msg = readBetterAuthActionError(
				result,
				"Invalid email or password.",
			)
			if (msg) setError(msg)
			else finishAuthSuccess()
		} catch {
			setError("Sign in failed. Please try again.")
		} finally {
			setIsLoading(false)
		}
	}

	async function handlePasswordSignup(e: React.FormEvent) {
		e.preventDefault()
		setIsLoading(true)
		setError(null)
		try {
			const result = await signUp.email({ name, email, password })
			const msg = readBetterAuthActionError(result, "Could not create account.")
			if (msg) setError(msg)
			else finishAuthSuccess()
		} catch {
			setError("Could not create account.")
		} finally {
			setIsLoading(false)
		}
	}

	return {
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
	}
}
