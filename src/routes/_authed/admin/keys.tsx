import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangle,
	Check,
	Clock,
	KeyRound,
	Plus,
	RotateCcw,
	ShieldOff,
	Trash2,
	X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	type AdminKeyRow,
	addAdminKeyFn,
	deleteAdminKeyFn,
	listAdminKeysFn,
	resetAdminKeyCooldownFn,
	toggleAdminKeyFn,
} from "@/features/admin/admin-keys.functions";

export const Route = createFileRoute("/_authed/admin/keys")({
	component: AdminKeysPage,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDERS = [
	"gemini",
	"google_tts",
	"pollinations",
	"openai",
	"kling",
	"luma",
] as const;

type Provider = (typeof PROVIDERS)[number];

const PROVIDER_DOT_COLOR: Record<Provider, string> = {
	gemini: "bg-blue-400",
	google_tts: "bg-emerald-400",
	openai: "bg-purple-400",
	pollinations: "bg-orange-400",
	kling: "bg-pink-400",
	luma: "bg-cyan-400",
};

const fieldClass =
	"w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none ring-offset-0 transition placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCooldownUntil(date: Date | null): string {
	if (!date) return "";
	const d = new Date(date);
	return `until ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function StatusBadge({
	status,
	cooldownUntil,
}: {
	status: AdminKeyRow["status"];
	cooldownUntil: Date | null;
}) {
	if (status === "active") {
		return (
			<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
				<span className="size-1.5 rounded-full bg-emerald-400" />
				Active
			</span>
		);
	}
	if (status === "cooling") {
		return (
			<span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
				<Clock className="size-3" />
				Cooling {formatCooldownUntil(cooldownUntil)}
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-600/50 bg-zinc-700/50 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
			<ShieldOff className="size-3" />
			Disabled
		</span>
	);
}

function ProviderBadge({ provider }: { provider: string }) {
	const dotColor = PROVIDER_DOT_COLOR[provider as Provider] ?? "bg-zinc-400";
	return (
		<span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300">
			<span className={`size-2 rounded-full ${dotColor}`} />
			{provider}
		</span>
	);
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
	label,
	value,
	color,
}: {
	label: string;
	value: number;
	color: "green" | "amber" | "zinc";
}) {
	const valueClass =
		color === "green"
			? "text-emerald-400"
			: color === "amber"
				? "text-amber-400"
				: "text-zinc-400";

	return (
		<div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
			<p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
				{label}
			</p>
			<p className={`mt-1 text-3xl font-bold ${valueClass}`}>{value}</p>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Delete Confirm Dialog
// ---------------------------------------------------------------------------

function DeleteDialog({
	keyId,
	onClose,
	onConfirm,
	isPending,
}: {
	keyId: string;
	onClose: () => void;
	onConfirm: (id: string) => void;
	isPending: boolean;
}) {
	const [confirmText, setConfirmText] = useState("");

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
			<div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
				<div className="mb-4 flex items-start gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-500/15">
						<AlertTriangle className="size-5 text-red-400" />
					</div>
					<div>
						<h2 className="text-base font-semibold text-zinc-100">
							Delete API Key
						</h2>
						<p className="mt-1 text-sm text-zinc-400">
							This action is permanent. The key will be removed from the pool
							immediately.
						</p>
					</div>
				</div>

				<div className="mb-4">
					<label
						htmlFor="confirm-delete"
						className="mb-1.5 block text-xs font-medium text-zinc-400"
					>
						Type <span className="font-mono text-zinc-300">delete</span> to
						confirm
					</label>
					<input
						name="confirm-delete"
						id="confirm-delete"
						className={fieldClass}
						value={confirmText}
						onChange={(e) => setConfirmText(e.target.value)}
						placeholder="delete"
					/>
				</div>

				<div className="flex justify-end gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={onClose}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						size="sm"
						disabled={confirmText !== "delete" || isPending}
						onClick={() => onConfirm(keyId)}
					>
						{isPending ? "Deleting…" : "Delete Key"}
					</Button>
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Add Key Modal
// ---------------------------------------------------------------------------

function AddKeyModal({
	onClose,
	onSuccess,
}: {
	onClose: () => void;
	onSuccess: () => void;
}) {
	const [provider, setProvider] = useState<Provider>("gemini");
	const [secret, setSecret] = useState("");
	const [showSecret, setShowSecret] = useState(false);
	const [ownerEmail, setOwnerEmail] = useState("");
	const [sortOrder, setSortOrder] = useState(0);

	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: (data: {
			provider: Provider;
			secret: string;
			ownerEmail?: string;
			sortOrder: number;
		}) => addAdminKeyFn({ data }),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success("API key added successfully.");
				queryClient.invalidateQueries({ queryKey: ["admin-keys"] });
				onSuccess();
			} else if (result.code === "duplicate") {
				toast.error(result.message ?? "Duplicate key.");
			} else {
				toast.error("Failed to add key.");
			}
		},
		onError: () => {
			toast.error("Failed to add key.");
		},
	});

	const isValid = secret.length >= 8;

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!isValid) return;
		mutation.mutate({
			provider,
			secret,
			ownerEmail: ownerEmail.trim() || undefined,
			sortOrder,
		});
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
						<select
							name="select-provider"
							id="select-provider"
							className={fieldClass}
							value={provider}
							onChange={(e) => setProvider(e.target.value as Provider)}
						>
							{PROVIDERS.map((p) => (
								<option key={p} value={p}>
									{p}
								</option>
							))}
						</select>
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
	);
}

// ---------------------------------------------------------------------------
// Keys Row Actions
// ---------------------------------------------------------------------------

function KeyRowActions({ row }: { row: AdminKeyRow }) {
	const queryClient = useQueryClient();
	const [deleteId, setDeleteId] = useState<string | null>(null);

	const toggleMutation = useMutation({
		mutationFn: (vars: { id: string; disabled: boolean }) =>
			toggleAdminKeyFn({ data: vars }),
		onSuccess: (result) => {
			console.log({ result });
			if (result.ok) {
				toast.success(result ? "Key updated." : "Key updated.");
				queryClient.invalidateQueries({ queryKey: ["admin-keys"] });
			} else {
				toast.error("Failed to update key.");
			}
		},
		onError: () => toast.error("Failed to update key."),
	});

	const cooldownMutation = useMutation({
		mutationFn: (id: string) => resetAdminKeyCooldownFn({ data: { id } }),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success("Cooldown reset.");
				queryClient.invalidateQueries({ queryKey: ["admin-keys"] });
			} else {
				toast.error("Failed to reset cooldown.");
			}
		},
		onError: () => toast.error("Failed to reset cooldown."),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteAdminKeyFn({ data: { id } }),
		onSuccess: (result) => {
			if (result.ok) {
				toast.success("Key deleted.");
				queryClient.invalidateQueries({ queryKey: ["admin-keys"] });
				setDeleteId(null);
			} else {
				toast.error("Failed to delete key.");
			}
		},
		onError: () => toast.error("Failed to delete key."),
	});

	const isDisabled = row.status === "disabled";

	return (
		<>
			<div className="flex items-center justify-end gap-1">
				{/* Enable / Disable */}
				<button
					type="button"
					title={isDisabled ? "Enable key" : "Disable key"}
					onClick={() =>
						toggleMutation.mutate({ id: row.id, disabled: !isDisabled })
					}
					disabled={toggleMutation.isPending}
					className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-40"
				>
					{isDisabled ? (
						<Check className="size-4 text-emerald-400" />
					) : (
						<ShieldOff className="size-4" />
					)}
				</button>

				{/* Reset Cooldown — only for cooling keys */}
				{row.status === "cooling" && (
					<button
						type="button"
						title="Reset cooldown"
						onClick={() => cooldownMutation.mutate(row.id)}
						disabled={cooldownMutation.isPending}
						className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-amber-400 disabled:opacity-40"
					>
						<RotateCcw className="size-4" />
					</button>
				)}

				{/* Delete */}
				<button
					type="button"
					title="Delete key"
					onClick={() => setDeleteId(row.id)}
					className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400"
				>
					<Trash2 className="size-4" />
				</button>
			</div>

			{deleteId && (
				<DeleteDialog
					keyId={deleteId}
					onClose={() => setDeleteId(null)}
					onConfirm={(id) => deleteMutation.mutate(id)}
					isPending={deleteMutation.isPending}
				/>
			)}
		</>
	);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function AdminKeysPage() {
	const [showAddModal, setShowAddModal] = useState(false);

	const { data, isLoading, isError } = useQuery({
		queryKey: ["admin-keys"],
		queryFn: () => listAdminKeysFn(),
		refetchInterval: 30_000,
	});

	const keys: AdminKeyRow[] = data?.ok ? data.keys : [];

	const activeCount = keys.filter((k) => k.status === "active").length;
	const coolingCount = keys.filter((k) => k.status === "cooling").length;
	const disabledCount = keys.filter((k) => k.status === "disabled").length;

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
									{[
										"Provider",
										"Key Hint",
										"Owner",
										"Sort",
										"Status",
										"Failures",
										"Last Error",
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
	);
}
