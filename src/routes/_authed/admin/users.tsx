import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Ban, RefreshCw, Search, UserPlus, Users } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

import {
	type AdminUserRow,
	listAdminUsersFn,
} from "@/features/admin/admin-user.functions"
import {
	AdjustCreditsModal,
	ChangePlanModal,
} from "@/features/admin/users/action-modals"
import {
	type ActiveModal,
	PlanBadge,
	RoleBadge,
	RowActions,
	StatCard,
} from "@/features/admin/users/components"
import { BanModal, InviteUserModal } from "@/features/admin/users/status-modals"

export const Route = createFileRoute("/_authed/admin/users")({
	component: AdminUsersPage,
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20

type AdminUserCursor = { createdAt: string; id: string }

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function AdminUsersPage() {
	const [search, setSearch] = useState("")
	const [debouncedSearch, setDebouncedSearch] = useState("")
	const [cursorStack, setCursorStack] = useState<AdminUserCursor[]>([])
	const [activeModal, setActiveModal] = useState<ActiveModal>(null)

	const currentCursor =
		cursorStack.length > 0 ? cursorStack[cursorStack.length - 1] : undefined
	const currentPage = cursorStack.length + 1

	// Debounce search — reset cursor stack on new search term.
	useEffect(() => {
		const t = setTimeout(() => {
			setDebouncedSearch(search)
			setCursorStack([])
		}, 300)
		return () => clearTimeout(t)
	}, [search])

	const { data, isLoading, isError, refetch, isFetching } = useQuery({
		queryKey: ["admin-users", debouncedSearch, currentCursor ?? null],
		queryFn: () =>
			listAdminUsersFn({
				data: {
					search: debouncedSearch || undefined,
					limit: PAGE_SIZE,
					cursor: currentCursor,
				},
			}),
		staleTime: 30_000,
	})

	const users: AdminUserRow[] = data?.ok ? data.users : []
	const total = data?.ok ? data.total : 0
	const nextCursor = data?.ok ? data.nextCursor : null
	const hasPrev = cursorStack.length > 0
	const hasNext = !!nextCursor

	const adminCount = users.filter((u) => u.role === "admin").length
	const bannedCount = users.filter((u) => u.banned).length

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
					{(hasPrev || hasNext) && (
						<div className="flex items-center justify-between text-sm text-zinc-400">
							<span>Page {currentPage}</span>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									disabled={!hasPrev}
									onClick={() => setCursorStack((s) => s.slice(0, -1))}
								>
									Previous
								</Button>
								<Button
									variant="outline"
									size="sm"
									disabled={!hasNext}
									onClick={() =>
										nextCursor && setCursorStack((s) => [...s, nextCursor])
									}
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
	)
}
