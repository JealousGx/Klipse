import { useMutation, useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"

import type { AdminKeyRow } from "../admin-keys.functions"
import { updateAdminKeyFn } from "../admin-keys.functions"
import { ProviderBadge } from "./components"
import { fieldClass, TASK_TYPE_LABEL, TASK_TYPES, type TaskType } from "./types"

// ---------------------------------------------------------------------------
// Edit Key Modal
// ---------------------------------------------------------------------------

export function EditKeyModal({
	row,
	onClose,
}: {
	row: AdminKeyRow
	onClose: () => void
}) {
	const [label, setLabel] = useState(row.label ?? "")
	const [modelId, setModelId] = useState(row.modelId ?? "")
	const [taskType, setTaskType] = useState<TaskType>(
		(row.taskType as TaskType) ?? "any",
	)
	const [sortOrder, setSortOrder] = useState(row.sortOrder)
	const [ownerEmail, setOwnerEmail] = useState(row.ownerEmail ?? "")

	const queryClient = useQueryClient()

	const mutation = useMutation({
		mutationFn: (data: {
			id: string
			label?: string
			modelId?: string
			taskType: TaskType
			sortOrder: number
			ownerEmail?: string
		}) => updateAdminKeyFn({ data }),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success("Key updated.")
				queryClient.invalidateQueries({ queryKey: ["admin-keys"] })
				onClose()
			} else {
				toast.error(result.message ?? "Failed to update key.")
			}
		},
		onError: () => toast.error("Failed to update key."),
	})

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		mutation.mutate({
			id: row.id,
			label: label.trim() || undefined,
			modelId: modelId.trim() || undefined,
			taskType,
			sortOrder,
			ownerEmail: ownerEmail.trim() || undefined,
		})
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
			<div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
				<div className="mb-5 flex items-center justify-between">
					<div>
						<h2 className="text-base font-semibold text-zinc-100">Edit Key</h2>
						<p className="mt-0.5 text-xs text-zinc-500">
							<ProviderBadge provider={row.provider} />
							<span className="ml-2 font-mono">…{row.keyHint}</span>
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
					>
						<X className="size-4" />
					</button>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					{/* Label */}
					<div>
						<label
							htmlFor="edit-label"
							className="mb-1.5 block text-xs font-medium text-zinc-400"
						>
							Label <span className="text-zinc-600">(optional)</span>
						</label>
						<input
							name="edit-label"
							id="edit-label"
							type="text"
							className={fieldClass}
							value={label}
							onChange={(e) => setLabel(e.target.value)}
							placeholder="e.g. Primary Gemini key"
						/>
					</div>

					{/* Model ID */}
					<div>
						<label
							htmlFor="edit-model-id"
							className="mb-1.5 block text-xs font-medium text-zinc-400"
						>
							Model ID override{" "}
							<span className="text-zinc-600">(optional)</span>
						</label>
						<input
							name="edit-model-id"
							id="edit-model-id"
							type="text"
							className={fieldClass}
							value={modelId}
							onChange={(e) => setModelId(e.target.value)}
							placeholder="e.g. gemini-2.5-flash or openrouter/free"
						/>
						<p className="mt-1 text-xs text-zinc-600">
							For Google TTS keys, use a voice name (e.g. en-US-Neural2-F).
						</p>
					</div>

					{/* Task Type */}
					<div>
						<label
							htmlFor="edit-task-type"
							className="mb-1.5 block text-xs font-medium text-zinc-400"
						>
							Task type
						</label>
						<Select
							onValueChange={(val) => setTaskType(val as TaskType)}
							value={taskType}
						>
							<SelectTrigger className={fieldClass}>
								<SelectValue placeholder="Select task type" />
							</SelectTrigger>
							<SelectContent>
								{TASK_TYPES.map((t) => (
									<SelectItem key={t} value={t}>
										{TASK_TYPE_LABEL[t]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="mt-1 text-xs text-zinc-600">
							"Any" means this key is used for all task types.
						</p>
					</div>

					{/* Sort Order */}
					<div>
						<label
							htmlFor="edit-sort-order"
							className="mb-1.5 block text-xs font-medium text-zinc-400"
						>
							Sort Order
						</label>
						<input
							name="edit-sort-order"
							id="edit-sort-order"
							type="number"
							className={fieldClass}
							value={sortOrder}
							onChange={(e) => setSortOrder(Number(e.target.value))}
							min={0}
						/>
					</div>

					{/* Owner Email */}
					<div>
						<label
							htmlFor="edit-owner-email"
							className="mb-1.5 block text-xs font-medium text-zinc-400"
						>
							Owner Email <span className="text-zinc-600">(optional)</span>
						</label>
						<input
							name="edit-owner-email"
							id="edit-owner-email"
							type="email"
							className={fieldClass}
							value={ownerEmail}
							onChange={(e) => setOwnerEmail(e.target.value)}
							placeholder="owner@example.com"
						/>
					</div>

					<div className="flex justify-end gap-2 pt-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onClose}
							disabled={mutation.isPending}
						>
							Cancel
						</Button>
						<Button type="submit" size="sm" disabled={mutation.isPending}>
							{mutation.isPending ? "Saving…" : "Save Changes"}
						</Button>
					</div>
				</form>
			</div>
		</div>
	)
}
