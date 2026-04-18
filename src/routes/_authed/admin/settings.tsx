import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
	getAdminSettingsFn,
	updateAdminSettingsFn,
} from "@/features/admin/admin-settings.functions";

export const Route = createFileRoute("/_authed/admin/settings")({
	component: AdminSettingsPage,
});

function AdminSettingsPage() {
	const queryClient = useQueryClient();

	const { data, isLoading } = useQuery({
		queryKey: ["admin-settings"],
		queryFn: () => getAdminSettingsFn(),
	});

	const mutation = useMutation({
		mutationFn: (registrationEnabled: boolean) =>
			updateAdminSettingsFn({ data: { registrationEnabled } }),
		onSuccess: (result) => {
			if (!result.ok) {
				toast.error(
					result.code === "unauthorized"
						? "Unauthorized."
						: "Failed to update settings.",
				);
				return;
			}
			toast.success("Settings saved.");
			void queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
			void queryClient.invalidateQueries({ queryKey: ["registration-status"] });
		},
		onError: () => toast.error("Failed to update settings."),
	});

	const settings = data?.ok ? data.settings : null;

	return (
		<div className="mx-auto max-w-2xl space-y-8">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold tracking-tight text-zinc-100">
					Platform Settings
				</h1>
				<p className="mt-1 text-sm text-zinc-400">
					Global toggles for platform behaviour.
				</p>
			</div>

			{/* Registration card */}
			<div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
				<div className="flex items-start justify-between gap-6">
					<div className="flex items-start gap-4">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
							<UserPlus className="size-4 text-zinc-300" />
						</div>
						<div>
							<p className="text-sm font-semibold text-zinc-100">
								New user registration
							</p>
							<p className="mt-0.5 text-xs text-zinc-400">
								Allow or block new accounts via email, password, and Google
								OAuth.
							</p>
							{settings?.envOverrideActive && (
								<div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
									<AlertTriangle className="size-3.5 shrink-0" />
									<span>
										Blocked by{" "}
										<code className="font-mono">
											REGISTRATION_ENABLED=false
										</code>{" "}
										env var — DB toggle has no effect while env override is
										active.
									</span>
								</div>
							)}
						</div>
					</div>

					{/* Toggle */}
					<button
						type="button"
						role="switch"
						aria-checked={settings?.registrationEnabled ?? true}
						disabled={
							isLoading || mutation.isPending || settings?.envOverrideActive
						}
						onClick={() => {
							if (!settings) return;
							mutation.mutate(!settings.registrationEnabled);
						}}
						className={[
							"relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40",
							(settings?.registrationEnabled ?? true)
								? "bg-primary"
								: "bg-zinc-700",
						].join(" ")}
					>
						<span
							className={[
								"pointer-events-none inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-200",
								(settings?.registrationEnabled ?? true)
									? "translate-x-5"
									: "translate-x-0",
							].join(" ")}
						/>
					</button>
				</div>

				<div className="mt-4 border-t border-zinc-800 pt-4">
					<p className="text-xs text-zinc-500">
						Current status:{" "}
						<span
							className={
								(settings?.registrationEnabled ?? true) &&
								!settings?.envOverrideActive
									? "font-medium text-emerald-400"
									: "font-medium text-red-400"
							}
						>
							{isLoading
								? "Loading…"
								: settings?.envOverrideActive
									? "Blocked (env override)"
									: (settings?.registrationEnabled ?? true)
										? "Open — new users can register"
										: "Closed — registrations disabled"}
						</span>
					</p>
				</div>
			</div>
		</div>
	);
}
