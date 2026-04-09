import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, LogOut, Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { Button } from "@/components/ui/button";
import { useDashboardRouteContext } from "@/context/useDashboardRouteContext";
import type { MeResponse } from "@/features/user/types/me";
import {
	deleteUserAccountFn,
	hasPasswordAccountFn,
} from "@/features/user/user-settings.functions";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/_authed/dashboard/settings")({
	staticData: { dashboardTitle: "Settings" },
	component: SettingsPage,
});

const planLabel: Record<MeResponse["plan"], string> = {
	free: "Free",
	starter: "Starter",
	creator: "Creator",
	empire: "Empire",
};

const fieldClass =
	"w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none ring-offset-2 transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function SettingsPage() {
	const { session } = useDashboardRouteContext();
	const user = session.user;
	const { refetch: refetchSession } = authClient.useSession();

	const [name, setName] = useState(user.name ?? "");
	const [isSavingName, setIsSavingName] = useState(false);
	const [isSigningOut, setIsSigningOut] = useState(false);

	const handleSaveName = async () => {
		const trimmed = name.trim();
		if (!trimmed || trimmed === (user.name ?? "")) return;
		setIsSavingName(true);
		try {
			await authClient.updateUser({ name: trimmed });
			await refetchSession({ query: { disableCookieCache: true } });
			toast.success("Name updated");
		} catch {
			toast.error("Could not save name. Please try again.");
		} finally {
			setIsSavingName(false);
		}
	}

	const handleSignOut = async () => {
		setIsSigningOut(true);
		try {
			await authClient.signOut();
			window.location.href = "/";
		} catch {
			toast.error("Sign out failed. Please try again.");
			setIsSigningOut(false);
		}
	}

	// ── Notification prefs — seeded from session, saved via authClient ────────
	// Better Auth syncs these to the DB via `additionalUserFields` (input: true).
	const notifyApproval =
		(user as { notifyVideoApproval?: boolean }).notifyVideoApproval ?? true;
	const notifyReady =
		(user as { notifyVideoReady?: boolean }).notifyVideoReady ?? true;
	const [notifApproval, setNotifApproval] = useState(notifyApproval);
	const [notifReady, setNotifReady] = useState(notifyReady);
	const [isSavingNotifs, setIsSavingNotifs] = useState(false);

	const handleToggleNotification = async (
		key: "notifyVideoApproval" | "notifyVideoReady",
		next: boolean,
	) => {
		if (key === "notifyVideoApproval") setNotifApproval(next);
		else setNotifReady(next);

		setIsSavingNotifs(true);
		try {
			await authClient.updateUser({ [key]: next } as Parameters<
				typeof authClient.updateUser
			>[0])
			await refetchSession({ query: { disableCookieCache: true } });
		} catch {
			// Roll back optimistic update
			if (key === "notifyVideoApproval") setNotifApproval(!next);
			else setNotifReady(!next);
			toast.error("Could not save notification preference.");
		} finally {
			setIsSavingNotifs(false);
		}
	}

	return (
		<div className="w-full space-y-8 pb-4 lg:space-y-10">
			{/* Hero */}
			<div className="relative overflow-hidden rounded-2xl border border-border/70 bg-linear-to-br from-primary/9 via-background to-chart-2/7 dark:from-primary/12 dark:to-chart-2/10">
				<div
					className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-primary/8 blur-3xl dark:bg-primary/12"
					aria-hidden
				/>
				<div className="relative flex items-center gap-4 p-6 lg:p-8">
					<div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
						<Settings className="size-5 text-primary" />
					</div>
					<div>
						<div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
							Account settings
						</div>
						<h2 className="font-heading mt-1 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
							{user.name || user.email}
						</h2>
						<p className="text-sm text-muted-foreground">
							{planLabel[(user.plan ?? "free") as MeResponse["plan"]]} plan
						</p>
					</div>
				</div>
			</div>

			{/* Profile */}
			<DashboardSection
				id="profile"
				titleId="profile-heading"
				title="Profile"
				description="Your name is shown in Klipse and on notifications."
				isFirst
			>
				<DashboardPanel variant="emphasis">
					<div className="space-y-5">
						{/* Name */}
						<div className="space-y-2">
							<label
								htmlFor="settings-name"
								className="text-sm font-medium text-foreground"
							>
								Name
							</label>
							<div className="flex gap-3">
								<input
									id="settings-name"
									type="text"
									className={fieldClass}
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="Your name"
									disabled={isSavingName}
								/>
								<Button
									type="button"
									size="sm"
									disabled={
										isSavingName ||
										!name.trim() ||
										name.trim() === (user.name ?? "")
									}
									onClick={() => void handleSaveName()}
								>
									{isSavingName ? "Saving…" : "Save"}
								</Button>
							</div>
						</div>

						{/* Email — read-only */}
						<div className="space-y-1.5">
							<p className="text-sm font-medium text-foreground">Email</p>
							<p className="text-sm text-muted-foreground">{user.email}</p>
							<p className="text-xs text-muted-foreground">
								Email cannot be changed here. Contact support if needed.
							</p>
						</div>

						{/* Plan */}
						<div className="flex items-center justify-between gap-4">
							<div className="space-y-1">
								<p className="text-sm font-medium text-foreground">Plan</p>
								<p className="text-sm text-muted-foreground">
									{planLabel[(user.plan ?? "free") as MeResponse["plan"]]}
								</p>
							</div>
							<Button type="button" variant="outline" size="sm" asChild>
								<Link to="/dashboard/billing">Manage plan</Link>
							</Button>
						</div>
					</div>
				</DashboardPanel>
			</DashboardSection>

			{/* Security */}
			<DashboardSection
				id="security"
				titleId="security-heading"
				title="Security"
				description="Manage your password. You can also sign in with Google or email code — a password is an optional extra sign-in method."
			>
				<DashboardPanel>
					<PasswordSection email={user.email} />
				</DashboardPanel>
			</DashboardSection>

			{/* Notifications */}
			<DashboardSection
				id="notifications"
				titleId="notifications-heading"
				title="Notifications"
				description="Control when Klipse sends you emails."
			>
				<DashboardPanel>
					<div className="space-y-4">
						<NotificationRow
							label="Video needs your approval"
							description="Sent when a video is ready and the channel is set to ask-first mode — you review before it publishes."
							enabled={notifApproval}
							disabled={isSavingNotifs}
							onToggle={(v) =>
								void handleToggleNotification("notifyVideoApproval", v)
							}
						/>
						<div className="border-t border-border/50" />
						<NotificationRow
							label="Video is ready"
							description="Sent whenever a video finishes generating and is ready to review or has been auto-published."
							enabled={notifReady}
							disabled={isSavingNotifs}
							onToggle={(v) =>
								void handleToggleNotification("notifyVideoReady", v)
							}
						/>
					</div>
				</DashboardPanel>
			</DashboardSection>

			{/* Danger zone */}
			<DashboardSection
				id="account"
				titleId="account-heading"
				title="Account"
				description="Sign out or permanently delete your account."
			>
				<DashboardPanel variant="danger">
					{/* Sign out */}
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="text-sm font-medium text-foreground">Sign out</p>
							<p className="text-xs text-muted-foreground">
								You will be redirected to the sign-in page.
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="gap-2 self-start border-destructive/40 text-destructive hover:bg-destructive/10 sm:self-auto"
							disabled={isSigningOut}
							onClick={() => void handleSignOut()}
						>
							<LogOut className="size-3.5" />
							{isSigningOut ? "Signing out…" : "Sign out"}
						</Button>
					</div>

					{/* Delete account */}
					<div className="mt-4 border-t border-destructive/20 pt-4">
						<DeleteAccountSection email={user.email} />
					</div>
				</DashboardPanel>
			</DashboardSection>
		</div>
	)
}

// ---------------------------------------------------------------------------
// PasswordSection
// ---------------------------------------------------------------------------

function PasswordSection({ email }: { email: string }) {
	const { data, isPending } = useQuery({
		queryKey: ["has-password-account"],
		queryFn: async () => {
			const r = await hasPasswordAccountFn();
			if (!r.ok) throw new Error("unauthorized");
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
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showCurrent, setShowCurrent] = useState(false);
	const [showNew, setShowNew] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const isValid =
		currentPassword.length > 0 &&
		newPassword.length >= 8 &&
		newPassword === confirmPassword;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isValid) return;

		setIsSaving(true);
		try {
			const result = await authClient.changePassword({
				currentPassword,
				newPassword,
				revokeOtherSessions: true,
			})
			if (result.error) {
				toast.error(result.error.message ?? "Could not change password.");
				return
			}
			toast.success("Password changed. Other sessions have been signed out.");
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
		} catch {
			toast.error("Something went wrong. Please try again.");
		} finally {
			setIsSaving(false);
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

type SetPasswordStep = "idle" | "otp-sent" | "saving";

function SetPasswordForm({ email }: { email: string }) {
	const [step, setStep] = useState<SetPasswordStep>("idle");
	const [otp, setOtp] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showNew, setShowNew] = useState(false);
	const [isBusy, setIsBusy] = useState(false);
	const otpRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (step === "otp-sent") {
			otpRef.current?.focus();
		}
	}, [step]);

	const isValid =
		otp.length === 6 &&
		newPassword.length >= 8 &&
		newPassword === confirmPassword;

	const handleSendCode = async () => {
		setIsBusy(true);
		try {
			const result = await authClient.emailOtp.sendVerificationOtp({
				email,
				type: "forget-password",
			})
			if (result.error) {
				toast.error(result.error.message ?? "Could not send code.");
				return
			}
			setStep("otp-sent");
			toast.success(`Verification code sent to ${email}`);
		} catch {
			toast.error("Something went wrong. Please try again.");
		} finally {
			setIsBusy(false);
		}
	}

	const handleSetPassword = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isValid) return;

		setIsBusy(true);
		try {
			const result = await authClient.emailOtp.resetPassword({
				email,
				otp,
				password: newPassword,
			})
			if (result.error) {
				toast.error(result.error.message ?? "Could not set password.");
				return
			}
			toast.success("Password set. You can now sign in with email + password.");
			// Reset form — next query refresh will show ChangePasswordForm
			setStep("idle");
			setOtp("");
			setNewPassword("");
			setConfirmPassword("");
		} catch {
			toast.error("Something went wrong. Please try again.");
		} finally {
			setIsBusy(false);
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

// ---------------------------------------------------------------------------
// NotificationRow
// ---------------------------------------------------------------------------

function NotificationRow({
	label,
	description,
	enabled,
	disabled,
	onToggle,
}: {
	label: string;
	description: string;
	enabled: boolean;
	disabled?: boolean;
	onToggle: (value: boolean) => void;
}) {
	const id = `notif-${label.replace(/\s+/g, "-").toLowerCase()}`;
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
			{/* Toggle switch */}
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

function DeleteAccountSection({ email }: { email: string }) {
	const [showConfirm, setShowConfirm] = useState(false);
	const [typedEmail, setTypedEmail] = useState("");
	const [isDeleting, setIsDeleting] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const canDelete = typedEmail.trim().toLowerCase() === email.toLowerCase();

	// Focus the confirmation input when the panel opens.
	const handleOpen = useCallback(() => {
		setTypedEmail("");
		setShowConfirm(true);
		requestAnimationFrame(() => inputRef.current?.focus());
	}, []);

	const handleCancel = () => {
		setShowConfirm(false);
		setTypedEmail("");
	}

	const handleDelete = async () => {
		if (!canDelete) return;
		setIsDeleting(true);
		try {
			const result = await deleteUserAccountFn();
			if (!result.ok) {
				toast.error(
					result.message ?? "Account deletion failed. Please contact support.",
				)
				setIsDeleting(false);
				return
			}
			// Success — sign out and redirect
			toast.success("Your account has been deleted.");
			await authClient.signOut();
			window.location.href = "/";
		} catch {
			toast.error("Something went wrong. Please try again or contact support.");
			setIsDeleting(false);
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
