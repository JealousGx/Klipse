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

import { addAdminKeyFn } from "../admin-keys.functions"
import {
	fieldClass,
	PROVIDER_LABEL,
	PROVIDERS,
	TASK_TYPE_LABEL,
	TASK_TYPES,
	type Provider,
	type TaskType,
} from "./types"

// ---------------------------------------------------------------------------
// Add Key Modal
// ---------------------------------------------------------------------------

export function AddKeyModal({
	onClose,
	onSuccess,
}: {
	onClose: () => void
	onSuccess: () => void
}) {
	const [provider, setProvider] = useState<Provider>("openrouter")
	const [secret, setSecret] = useState("")
	const [showSecret, setShowSecret] = useState(false)
	const [ownerEmail, setOwnerEmail] = useState("")
	const [sortOrder, setSortOrder] = useState(0)
	const [label, setLabel] = useState("")
	const [modelId, setModelId] = useState("")
	const [taskType, setTaskType] = useState<TaskType>("any")

	const queryClient = useQueryClient()

	const mutation = useMutation({
		mutationFn: (data: {
			provider: Provider
			secret: string
			ownerEmail?: string
			sortOrder: number
			label?: string
			modelId?: string
			taskType: TaskType
		}) => addAdminKeyFn({ data }),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success("API key added successfully.")
				queryClient.invalidateQueries({ queryKey: ["admin-keys"] })
				onSuccess()
			} else if (result.code === "duplicate") {
				toast.error(result.message ?? "Duplicate key.")
			} else {
				toast.error("Failed to add key.")
			}
		},
		onError: () => {
			toast.error("Failed to add key.")
		},
	})

	const isValid = secret.length >= 8

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!isValid) return
		mutation.mutate({
			provider,
			secret,
			ownerEmail: ownerEmail.trim() || undefined,
			sortOrder,
			label: label.trim() || undefined,
			modelId: modelId.trim() || undefined,
			taskType,
		})
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
			<div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
				<div className="mb-5 flex items-center justify-between">
					<h2 className="text-base font-semibold text-zinc-100">Add API Key</h2>
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
					>
						<X className="size-4" />
					</button>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					{/* Provider */}
					<div>
						<label
							htmlFor="select-provider"
							className="mb-1.5 block text-xs font-medium text-zinc-400"
						>
							Provider
						</label>
						<Select
							onValueChange={(val) => setProvider(val as Provider)}
							defaultValue={provider}
						>
							<SelectTrigger className={fieldClass}>
								<SelectValue placeholder="Select provider" />
							</SelectTrigger>
							<SelectContent>
								{PROVIDERS.map((p) => (
									<SelectItem key={p} value={p}>
										{PROVIDER_LABEL[p]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Secret */}
					<div>
						<label
							htmlFor="secret"
							className="mb-1.5 block text-xs font-medium text-zinc-400"
						>
							Secret
						</label>
						<div className="relative">
							<input
								name="secret"
								id="secret"
								type={showSecret ? "text" : "password"}
								className={`${fieldClass} pr-10`}
								value={secret}
								onChange={(e) => setSecret(e.target.value)}
								placeholder="API key secret…"
								autoComplete="off"
							/>
							<button
								type="button"
								onClick={() => setShowSecret((v) => !v)}
								className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
							>
								{showSecret ? "Hide" : "Show"}
							</button>
						</div>
					</div>

					{/* Owner Email */}
					<div>
						<label
							htmlFor="api-owner-email"
							className="mb-1.5 block text-xs font-medium text-zinc-400"
						>
							Owner Email <span className="text-zinc-600">(optional)</span>
						</label>
						<input
							name="api-owner-email"
							id="api-owner-email"
							type="email"
							className={fieldClass}
							value={ownerEmail}
							onChange={(e) => setOwnerEmail(e.target.value)}
							placeholder="owner@example.com"
						/>
					</div>

					{/* Sort Order */}
					<div>
						<label
							htmlFor="sort-order"
							className="mb-1.5 block text-xs font-medium text-zinc-400"
						>
							Sort Order
						</label>
						<input
							name="sort-order"
							id="sort-order"
							type="number"
							className={fieldClass}
							value={sortOrder}
							onChange={(e) => setSortOrder(Number(e.target.value))}
							min={0}
						/>
					</div>

					{/* Label */}
					<div>
						<label
							htmlFor="key-label"
							className="mb-1.5 block text-xs font-medium text-zinc-400"
						>
							Label <span className="text-zinc-600">(optional)</span>
						</label>
						<input
							name="key-label"
							id="key-label"
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
							htmlFor="model-id"
							className="mb-1.5 block text-xs font-medium text-zinc-400"
						>
							Model ID override{" "}
							<span className="text-zinc-600">(optional)</span>
						</label>
						<input
							name="model-id"
							id="model-id"
							type="text"
							className={fieldClass}
							value={modelId}
							onChange={(e) => setModelId(e.target.value)}
							placeholder="e.g. gemini-2.5-flash or nvidia/nemotron-3-super:free"
						/>
						<p className="mt-1 text-xs text-zinc-600">
							For Google TTS keys, use a voice name (e.g. en-US-Neural2-F).
						</p>
					</div>

					{/* Task Type */}
					<div>
						<label
							htmlFor="task-type"
							className="mb-1.5 block text-xs font-medium text-zinc-400"
						>
							Task type
						</label>
						<Select
							onValueChange={(val) => setTaskType(val as TaskType)}
							defaultValue={taskType}
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
						<Button
							type="submit"
							size="sm"
							disabled={!isValid || mutation.isPending}
						>
							{mutation.isPending ? "Adding…" : "Add Key"}
						</Button>
					</div>
				</form>
			</div>
		</div>
	)
}
