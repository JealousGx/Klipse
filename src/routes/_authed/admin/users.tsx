import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	Ban,
	CreditCard,
	MoreHorizontal,
	RefreshCw,
	Search,
	ShieldCheck,
	ShieldOff,
	UserPlus,
	Users,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	type AdminUserRow,
	adjustUserCreditsFn,
	banUserFn,
	changeUserPlanFn,
	createUserFn,
	listAdminUsersFn,
	setUserRoleFn,
	unbanUserFn,
} from "@/features/admin/admin-user.functions";

export const Route = createFileRoute("/_authed/admin/users")({
	component: AdminUsersPage,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

const PLANS = ["free", "starter", "creator", "empire"] as const;
type Plan = (typeof PLANS)[number];

const fieldClass =
	"w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none ring-offset-0 transition placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50";

// ---------------------------------------------------------------------------
// Helpers / Sub-components
// ---------------------------------------------------------------------------

function PlanBadge({ plan }: { plan: string }) {
	const style =
		plan === "starter"
			? "bg-blue-500/15 text-blue-400 border-blue-500/30"
			: plan === "creator"
				? "bg-purple-500/15 text-purple-400 border-purple-500/30"
				: plan === "empire"
					? "bg-amber-500/15 text-amber-400 border-amber-500/30"
					: "bg-zinc-700/50 text-zinc-400 border-zinc-600/50";

	return (
		<span
			className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${style}`}
		>
			{plan}
		</span>
	);
}

function RoleBadge({ role }: { role: string | null }) {
	if (role === "admin") {
		return (
			<span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
				<ShieldCheck className="size-3" />
				Admin
			</span>
		);
	}
	return <span className="text-xs text-zinc-500">User</span>;
}

function StatCard({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
			<p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
				{label}
			</p>
			<p className="mt-1 text-3xl font-bold text-zinc-100">{value}</p>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Adjust Credits Modal
// ---------------------------------------------------------------------------

function AdjustCreditsModal({
	user,
	onClose,
}: {
	user: AdminUserRow;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const [delta, setDelta] = useState<number>(0);
	const [reason, setReason] = useState("");

	const mutation = useMutation({
		mutationFn: () =>
			adjustUserCreditsFn({ data: { userId: user.id, delta, reason } }),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success(`Credits adjusted. New balance: ${result.newCredits}`);
				queryClient.invalidateQueries({ queryKey: ["admin-users"] });
				onClose();
			} else if (result.code === "below_zero") {
				toast.error("This adjustment would result in negative credits.");
			} else {
				toast.error("Failed to adjust credits.");
			}
		},
		onError: () => toast.error("Failed to adjust credits."),
	});

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
	);
}

// ---------------------------------------------------------------------------
// Change Plan Modal
// ---------------------------------------------------------------------------

function ChangePlanModal({
	user,
	onClose,
}: {
	user: AdminUserRow;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const [plan, setPlan] = useState<Plan>(user.plan as Plan);

	const mutation = useMutation({
		mutationFn: () => changeUserPlanFn({ data: { userId: user.id, plan } }),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success(`Plan changed to ${plan}.`);
				queryClient.invalidateQueries({ queryKey: ["admin-users"] });
				onClose();
			} else {
				toast.error("Failed to change plan.");
			}
		},
		onError: () => toast.error("Failed to change plan."),
	});

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
	);
}

// ---------------------------------------------------------------------------
// Ban Modal
// ---------------------------------------------------------------------------

function BanModal({
	user,
	onClose,
}: {
	user: AdminUserRow;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const [reason, setReason] = useState("");

	const mutation = useMutation({
		mutationFn: () =>
			banUserFn({
				data: { userId: user.id, reason: reason.trim() || undefined },
			}),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success("User banned.");
				queryClient.invalidateQueries({ queryKey: ["admin-users"] });
				onClose();
			} else if (result.code === "cannot_ban_admin") {
				toast.error("Cannot ban another admin.");
			} else {
				toast.error("Failed to ban user.");
			}
		},
		onError: () => toast.error("Failed to ban user."),
	});

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
	);
}

// ---------------------------------------------------------------------------
// Invite User Modal
// ---------------------------------------------------------------------------

function InviteUserModal({ onClose }: { onClose: () => void }) {
	const queryClient = useQueryClient();
	const [email, setEmail] = useState("");
	const [name, setName] = useState("");

	const mutation = useMutation({
		mutationFn: () =>
			createUserFn({ data: { email: email.trim(), name: name.trim() } }),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success("User created — Invitation email sent.");
				queryClient.invalidateQueries({ queryKey: ["admin-users"] });
				onClose();
			} else if (result.code === "email_taken") {
				toast.error("An account with this email already exists.");
			} else {
				toast.error("Failed to create user. Please try again.");
			}
		},
		onError: () => toast.error("Failed to create user. Please try again."),
	});

	const canSubmit =
		email.trim().length > 0 &&
		email.includes("@") &&
		name.trim().length > 0 &&
		!mutation.isPending;

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
	);
}

// ---------------------------------------------------------------------------
// Row Actions Dropdown
// ---------------------------------------------------------------------------

type ActiveModal =
	| { type: "invite" }
	| { type: "credits"; user: AdminUserRow }
	| { type: "plan"; user: AdminUserRow }
	| { type: "ban"; user: AdminUserRow }
	| null;

function RowActions({
	row,
	onOpenModal,
}: {
	row: AdminUserRow;
	onOpenModal: (modal: ActiveModal) => void;
}) {
	const queryClient = useQueryClient();

	const roleMutation = useMutation({
		mutationFn: (role: "admin" | "user") =>
			setUserRoleFn({ data: { userId: row.id, role } }),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success("Role updated.");
				queryClient.invalidateQueries({ queryKey: ["admin-users"] });
			} else if (result.code === "cannot_self_demote") {
				toast.error("You cannot demote yourself.");
			} else {
				toast.error("Failed to update role.");
			}
		},
		onError: () => toast.error("Failed to update role."),
	});

	const unbanMutation = useMutation({
		mutationFn: () => unbanUserFn({ data: { userId: row.id } }),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success("User unbanned.");
				queryClient.invalidateQueries({ queryKey: ["admin-users"] });
			} else {
				toast.error("Failed to unban user.");
			}
		},
		onError: () => toast.error("Failed to unban user."),
	});

	const isAdmin = row.role === "admin";
	const isBanned = row.banned ?? false;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
				>
					<MoreHorizontal className="size-4" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuLabel className="text-xs text-zinc-500">
					{row.email}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={() => onOpenModal({ type: "credits", user: row })}
				>
					<CreditCard className="size-3.5" />
					Adjust Credits
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => onOpenModal({ type: "plan", user: row })}
				>
					<Search className="size-3.5" />
					Change Plan
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => {
						const newRole = isAdmin ? "user" : "admin";
						if (
							window.confirm(
								`${isAdmin ? "Revoke admin from" : "Grant admin to"} ${row.email}?`,
							)
						) {
							roleMutation.mutate(newRole);
						}
					}}
					disabled={roleMutation.isPending}
				>
					{isAdmin ? (
						<ShieldOff className="size-3.5" />
					) : (
						<ShieldCheck className="size-3.5" />
					)}
					{isAdmin ? "Revoke Admin" : "Grant Admin"}
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				{isBanned ? (
					<DropdownMenuItem
						onClick={() => {
							if (window.confirm(`Unban ${row.email}?`)) {
								unbanMutation.mutate();
							}
						}}
						disabled={unbanMutation.isPending}
					>
						<Ban className="size-3.5" />
						Unban User
					</DropdownMenuItem>
				) : (
					<DropdownMenuItem
						variant="destructive"
						onClick={() => onOpenModal({ type: "ban", user: row })}
					>
						<Ban className="size-3.5" />
						Ban User
					</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function AdminUsersPage() {
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [page, setPage] = useState(0);
	const [activeModal, setActiveModal] = useState<ActiveModal>(null);

	// Debounce search
	useEffect(() => {
		const t = setTimeout(() => {
			setDebouncedSearch(search);
			setPage(0);
		}, 300);
		return () => clearTimeout(t);
	}, [search]);

	const { data, isLoading, isError, refetch, isFetching } = useQuery({
		queryKey: ["admin-users", debouncedSearch, page],
		queryFn: () =>
			listAdminUsersFn({
				data: {
					search: debouncedSearch || undefined,
					limit: PAGE_SIZE,
					offset: page * PAGE_SIZE,
				},
			}),
		staleTime: 30_000,
	});

	const users: AdminUserRow[] = data?.ok ? data.users : [];
	const total = data?.ok ? data.total : 0;

	const adminCount = users.filter((u) => u.role === "admin").length;
	const bannedCount = users.filter((u) => u.banned).length;

	const start = page * PAGE_SIZE + 1;
	const end = Math.min(start + users.length - 1, total);
	const hasPrev = page > 0;
	const hasNext = end < total;

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-zinc-100">Users</h1>
					<p className="mt-1 text-sm text-zinc-400">
						Manage user accounts, credits, plans, and roles.
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Button size="sm" onClick={() => setActiveModal({ type: "invite" })}>
						<UserPlus className="mr-1.5 size-4" />
						Invite User
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => refetch()}
						disabled={isFetching}
					>
						<RefreshCw
							className={`mr-1.5 size-4 ${isFetching ? "animate-spin" : ""}`}
						/>
						Refresh
					</Button>
				</div>
			</div>

			{/* Search */}
			<div className="relative">
				<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
				<input
					className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
					placeholder="Search by name or email…"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-3 gap-4">
				<StatCard label="Total Users" value={total} />
				<StatCard label="Admins" value={adminCount} />
				<StatCard label="Banned" value={bannedCount} />
			</div>

			{/* Table */}
			{isLoading ? (
				<div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-4">
					<div className="space-y-2">
						{Array.from({ length: 8 }).map((_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: skeleton
								key={i}
								className="h-12 animate-pulse rounded-lg bg-zinc-800/60"
							/>
						))}
					</div>
				</div>
			) : isError || (data && !data.ok) ? (
				<div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
					Failed to load users.
				</div>
			) : (
				<>
					<div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-zinc-800">
										{[
											"Name / Email",
											"Plan",
											"Credits",
											"Role",
											"Status",
											"Joined",
											"Actions",
										].map((col) => (
											<th
												key={col}
												className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500"
											>
												{col}
											</th>
										))}
									</tr>
								</thead>
								<tbody className="divide-y divide-zinc-800/60">
									{users.length === 0 ? (
										<tr>
											<td
												colSpan={7}
												className="px-4 py-12 text-center text-sm text-zinc-500"
											>
												<Users className="mx-auto mb-2 size-8 text-zinc-700" />
												No users found.
											</td>
										</tr>
									) : (
										users.map((user) => (
											<tr
												key={user.id}
												className="transition-colors hover:bg-zinc-800/40"
											>
												<td className="px-4 py-3.5">
													<p className="font-medium text-zinc-200">
														{user.name}
													</p>
													<p className="text-xs text-zinc-500">{user.email}</p>
												</td>
												<td className="px-4 py-3.5">
													<PlanBadge plan={user.plan} />
												</td>
												<td className="px-4 py-3.5 tabular-nums text-zinc-300">
													{user.creditsRemaining.toLocaleString()}
												</td>
												<td className="px-4 py-3.5">
													<RoleBadge role={user.role} />
												</td>
												<td className="px-4 py-3.5">
													{user.banned ? (
														<span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
															<Ban className="size-3" />
															Banned
														</span>
													) : null}
												</td>
												<td className="px-4 py-3.5 text-xs text-zinc-500">
													{new Date(user.createdAt).toLocaleDateString()}
												</td>
												<td className="px-4 py-3.5">
													<RowActions row={user} onOpenModal={setActiveModal} />
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>

					{/* Pagination */}
					{total > PAGE_SIZE && (
						<div className="flex items-center justify-between text-sm text-zinc-400">
							<span>
								Showing {start}–{end} of {total}
							</span>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									disabled={!hasPrev}
									onClick={() => setPage((p) => p - 1)}
								>
									Previous
								</Button>
								<Button
									variant="outline"
									size="sm"
									disabled={!hasNext}
									onClick={() => setPage((p) => p + 1)}
								>
									Next
								</Button>
							</div>
						</div>
					)}
				</>
			)}

			{/* Modals */}
			{activeModal?.type === "invite" && (
				<InviteUserModal onClose={() => setActiveModal(null)} />
			)}
			{activeModal?.type === "credits" && (
				<AdjustCreditsModal
					user={activeModal.user}
					onClose={() => setActiveModal(null)}
				/>
			)}
			{activeModal?.type === "plan" && (
				<ChangePlanModal
					user={activeModal.user}
					onClose={() => setActiveModal(null)}
				/>
			)}
			{activeModal?.type === "ban" && (
				<BanModal
					user={activeModal.user}
					onClose={() => setActiveModal(null)}
				/>
			)}
		</div>
	);
}
