import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
	AlertTriangle,
	Check,
	KeyRound,
	MoreHorizontal,
	Pencil,
	Plus,
	RotateCcw,
	ShieldOff,
	Trash2,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
	type AdminKeyRow,
	deleteAdminKeyFn,
	listAdminKeysFn,
	resetAdminKeyCooldownFn,
	toggleAdminKeyFn,
} from "@/features/admin/admin-keys.functions"
import { AddKeyModal } from "@/features/admin/keys/add-modal"
import {
	DeleteDialog,
	ProviderBadge,
	StatCard,
	StatusBadge,
} from "@/features/admin/keys/components"
import { EditKeyModal } from "@/features/admin/keys/edit-modal"
import { TASK_TYPE_LABEL, type TaskType } from "@/features/admin/keys/types"

export const Route = createFileRoute("/_authed/admin/keys")({
	component: AdminKeysPage,
})

// ---------------------------------------------------------------------------
// Keys Row Actions
// ---------------------------------------------------------------------------

function KeyRowActions({ row }: { row: AdminKeyRow }) {
	const queryClient = useQueryClient()
	const [deleteId, setDeleteId] = useState<string | null>(null)
	const [editRow, setEditRow] = useState<AdminKeyRow | null>(null)

	const toggleMutation = useMutation({
		mutationFn: (vars: { id: string; disabled: boolean }) =>
			toggleAdminKeyFn({ data: vars }),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success("Key updated.")
				queryClient.invalidateQueries({ queryKey: ["admin-keys"] })
			} else {
				toast.error("Failed to update key.")
			}
		},
		onError: () => toast.error("Failed to update key."),
	})

	const cooldownMutation = useMutation({
		mutationFn: (id: string) => resetAdminKeyCooldownFn({ data: { id } }),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success("Cooldown reset.")
				queryClient.invalidateQueries({ queryKey: ["admin-keys"] })
			} else {
				toast.error("Failed to reset cooldown.")
			}
		},
		onError: () => toast.error("Failed to reset cooldown."),
	})

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteAdminKeyFn({ data: { id } }),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success("Key deleted.")
				queryClient.invalidateQueries({ queryKey: ["admin-keys"] })
				setDeleteId(null)
			} else {
				toast.error("Failed to delete key.")
			}
		},
		onError: () => toast.error("Failed to delete key."),
	})

	const isDisabled = row.status === "disabled"
	const isCooling = row.status === "cooling"

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
					>
						<MoreHorizontal className="size-4" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-44">
					<DropdownMenuItem onClick={() => setEditRow(row)}>
						<Pencil className="size-3.5" />
						Edit Key
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onClick={() =>
							toggleMutation.mutate({ id: row.id, disabled: !isDisabled })
						}
						disabled={toggleMutation.isPending}
					>
						{isDisabled ? (
							<Check className="size-3.5 text-emerald-400" />
						) : (
							<ShieldOff className="size-3.5" />
						)}
						{isDisabled ? "Enable Key" : "Disable Key"}
					</DropdownMenuItem>
					{isCooling && (
						<DropdownMenuItem
							onClick={() => cooldownMutation.mutate(row.id)}
							disabled={cooldownMutation.isPending}
						>
							<RotateCcw className="size-3.5" />
							Reset Cooldown
						</DropdownMenuItem>
					)}
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onClick={() => setDeleteId(row.id)}
					>
						<Trash2 className="size-3.5" />
						Delete Key
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			{deleteId && (
				<DeleteDialog
					keyId={deleteId}
					onClose={() => setDeleteId(null)}
					onConfirm={(id) => deleteMutation.mutate(id)}
					isPending={deleteMutation.isPending}
				/>
			)}
			{editRow && (
				<EditKeyModal row={editRow} onClose={() => setEditRow(null)} />
			)}
		</>
	)
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const TABLE_COLS = [
	"Provider",
	"Key Hint",
	"Label",
	"Model",
	"Task",
	"Owner",
	"Sort",
	"Status",
	"Failures",
	"Last Error",
	"Actions",
]

function AdminKeysPage() {
	const [showAddModal, setShowAddModal] = useState(false)

	const { data, isLoading, isError } = useQuery({
		queryKey: ["admin-keys"],
		queryFn: () => listAdminKeysFn(),
		staleTime: 15_000,
		refetchInterval: 30_000,
	})

	const keys: AdminKeyRow[] = data?.ok ? data.keys : []
	const activeCount = keys.filter((k) => k.status === "active").length
	const coolingCount = keys.filter((k) => k.status === "cooling").length
	const disabledCount = keys.filter((k) => k.status === "disabled").length

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-zinc-100">API Keys</h1>
					<p className="mt-1 text-sm text-zinc-400">
						Manage AI provider key pool — add, disable, or reset keys.
					</p>
				</div>
				<Button
					size="sm"
					onClick={() => setShowAddModal(true)}
					className="shrink-0"
				>
					<Plus className="mr-1.5 size-4" />
					Add Key
				</Button>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-3 gap-4">
				<StatCard label="Active" value={activeCount} color="green" />
				<StatCard label="Cooling Down" value={coolingCount} color="amber" />
				<StatCard label="Disabled" value={disabledCount} color="zinc" />
			</div>

			{/* Table */}
			{isLoading ? (
				<div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
					<div className="space-y-px p-4">
						{Array.from({ length: 5 }).map((_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
								key={i}
								className="h-12 animate-pulse rounded-lg bg-zinc-800/60"
							/>
						))}
					</div>
				</div>
			) : isError || (data && !data.ok) ? (
				<div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
					<AlertTriangle className="size-4 shrink-0" />
					Failed to load API keys.
				</div>
			) : keys.length === 0 ? (
				<div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 py-16 text-center">
					<div className="flex size-14 items-center justify-center rounded-full bg-zinc-800">
						<KeyRound className="size-6 text-zinc-500" />
					</div>
					<p className="mt-4 text-sm font-medium text-zinc-300">
						No API keys yet.
					</p>
					<p className="mt-1 text-xs text-zinc-500">
						Add your first key to get started.
					</p>
					<Button
						size="sm"
						className="mt-4"
						onClick={() => setShowAddModal(true)}
					>
						<Plus className="mr-1.5 size-4" />
						Add Key
					</Button>
				</div>
			) : (
				<div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-zinc-800">
									{TABLE_COLS.map((col) => (
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
								{keys.map((key) => (
									<tr
										key={key.id}
										className="transition-colors hover:bg-zinc-800/40"
									>
										<td className="px-4 py-3.5">
											<ProviderBadge provider={key.provider} />
										</td>
										<td className="px-4 py-3.5 font-mono text-xs text-zinc-400">
											…{key.keyHint}
										</td>
										<td className="max-w-36 px-4 py-3.5 text-xs text-zinc-400">
											{key.label ? (
												<span className="truncate block" title={key.label}>
													{key.label}
												</span>
											) : (
												<span className="text-zinc-600">—</span>
											)}
										</td>
										<td className="max-w-40 px-4 py-3.5 font-mono text-xs text-zinc-400">
											{key.modelId ? (
												<span className="truncate block" title={key.modelId}>
													{key.modelId}
												</span>
											) : (
												<span className="text-zinc-600">—</span>
											)}
										</td>
										<td className="px-4 py-3.5 text-xs text-zinc-400">
											{key.taskType === "any" ? (
												<span className="text-zinc-600">any</span>
											) : (
												<span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-zinc-300">
													{TASK_TYPE_LABEL[key.taskType as TaskType] ??
														key.taskType}
												</span>
											)}
										</td>
										<td className="px-4 py-3.5 text-zinc-400">
											{key.ownerEmail ?? (
												<span className="text-zinc-600">—</span>
											)}
										</td>
										<td className="px-4 py-3.5 text-zinc-400">
											{key.sortOrder}
										</td>
										<td className="px-4 py-3.5">
											<StatusBadge
												status={key.status}
												cooldownUntil={key.cooldownUntil}
											/>
										</td>
										<td className="px-4 py-3.5 text-zinc-400">
											{key.failureCount > 0 ? (
												<span className="text-amber-400">
													{key.failureCount}
												</span>
											) : (
												<span className="text-zinc-600">0</span>
											)}
										</td>
										<td className="max-w-50 px-4 py-3.5">
											{key.errorType ? (
												<span
													className="block truncate text-xs text-zinc-500"
													title={key.errorType}
												>
													{key.errorType}
												</span>
											) : (
												<span className="text-zinc-600">—</span>
											)}
										</td>
										<td className="px-4 py-3.5">
											<KeyRowActions row={key} />
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Add Key Modal */}
			{showAddModal && (
				<AddKeyModal
					onClose={() => setShowAddModal(false)}
					onSuccess={() => setShowAddModal(false)}
				/>
			)}
		</div>
	)
}
