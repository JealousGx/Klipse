import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
	Ban,
	CreditCard,
	MoreHorizontal,
	Search,
	ShieldCheck,
	ShieldOff,
} from "lucide-react"
import { toast } from "sonner"

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
	type AdminUserRow,
	setUserRoleFn,
	unbanUserFn,
} from "../admin-user.functions"

// ---------------------------------------------------------------------------
// Shared style constant
// ---------------------------------------------------------------------------

export const fieldClass =
	"w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none ring-offset-0 transition placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"

// ---------------------------------------------------------------------------
// Small display components
// ---------------------------------------------------------------------------

export function PlanBadge({ plan }: { plan: string }) {
	const style =
		plan === "starter"
			? "bg-blue-500/15 text-blue-400 border-blue-500/30"
			: plan === "creator"
				? "bg-purple-500/15 text-purple-400 border-purple-500/30"
				: plan === "empire"
					? "bg-amber-500/15 text-amber-400 border-amber-500/30"
					: "bg-zinc-700/50 text-zinc-400 border-zinc-600/50"

	return (
		<span
			className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${style}`}
		>
			{plan}
		</span>
	)
}

export function RoleBadge({ role }: { role: string | null }) {
	if (role === "admin") {
		return (
			<span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
				<ShieldCheck className="size-3" />
				Admin
			</span>
		)
	}
	return <span className="text-xs text-zinc-500">User</span>
}

export function StatCard({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
			<p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
				{label}
			</p>
			<p className="mt-1 text-3xl font-bold text-zinc-100">{value}</p>
		</div>
	)
}

// ---------------------------------------------------------------------------
// ActiveModal discriminated union
// ---------------------------------------------------------------------------

export type ActiveModal =
	| { type: "invite" }
	| { type: "credits"; user: AdminUserRow }
	| { type: "plan"; user: AdminUserRow }
	| { type: "ban"; user: AdminUserRow }
	| null

// ---------------------------------------------------------------------------
// RowActions dropdown
// ---------------------------------------------------------------------------

export function RowActions({
	row,
	onOpenModal,
}: {
	row: AdminUserRow
	onOpenModal: (modal: ActiveModal) => void
}) {
	const queryClient = useQueryClient()

	const roleMutation = useMutation({
		mutationFn: (role: "admin" | "user") =>
			setUserRoleFn({ data: { userId: row.id, role } }),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success("Role updated.")
				queryClient.invalidateQueries({ queryKey: ["admin-users"] })
			} else if (result.code === "cannot_self_demote") {
				toast.error("You cannot demote yourself.")
			} else {
				toast.error("Failed to update role.")
			}
		},
		onError: () => toast.error("Failed to update role."),
	})

	const unbanMutation = useMutation({
		mutationFn: () => unbanUserFn({ data: { userId: row.id } }),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success("User unbanned.")
				queryClient.invalidateQueries({ queryKey: ["admin-users"] })
			} else {
				toast.error("Failed to unban user.")
			}
		},
		onError: () => toast.error("Failed to unban user."),
	})

	const isAdmin = row.role === "admin"
	const isBanned = row.banned ?? false

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
						const newRole = isAdmin ? "user" : "admin"
						if (
							window.confirm(
								`${isAdmin ? "Revoke admin from" : "Grant admin to"} ${row.email}?`,
							)
						) {
							roleMutation.mutate(newRole)
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
								unbanMutation.mutate()
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
	)
}
