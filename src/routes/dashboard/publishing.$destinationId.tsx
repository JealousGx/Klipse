import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Copy, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

import {
	deleteChannelFn,
	updateChannelFn,
} from "@/features/channels/channels.functions";

import { channelQueryOptions } from "@/lib/queries/dashboard-queries";
import { cn } from "@/lib/utils";
import { youtubeChannelUrl } from "@/lib/youtube";

const fieldClass =
	"w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none ring-offset-2 transition focus:ring-2 focus:ring-ring";

export const Route = createFileRoute("/dashboard/publishing/$destinationId")({
	staticData: { dashboardTitle: "Publishing destination" },
	beforeLoad: ({ context, params }) => {
		void context.queryClient.ensureQueryData(
			channelQueryOptions(params.destinationId),
		);
	},
	component: PublishingDestinationPage,
});

function PublishingDestinationPage() {
	const { destinationId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const channelQuery = useQuery(channelQueryOptions(destinationId));

	const [displayName, setDisplayName] = useState("");
	const [niche, setNiche] = useState("");

	/** Draft UC id — only used while unlinked; after link, id is read-only until disconnect. */
	const [pendingYtId, setPendingYtId] = useState("");

	const deleteMutation = useMutation({
		mutationFn: async () => {
			return deleteChannelFn({ data: { channelId: destinationId } });
		},
		onSuccess: (r) => {
			if (r.ok) {
				toast.success("Destination removed");
				void queryClient.invalidateQueries({ queryKey: ["channels"] });
				void navigate({ to: "/dashboard/publishing" });
				return;
			}
			toast.error("Couldn’t remove destination");
		},
	});

	const onConnectAccount = () => {
		toast.info("Connectors in progress", {
			description:
				"YouTube will be the first linked platform here; others share this destination pattern.",
		});
	};

	const updateProfileMutation = useMutation({
		mutationFn: async () => {
			return updateChannelFn({
				data: {
					channelId: destinationId,
					name: displayName.trim(),
					niche: niche.trim(),
				},
			});
		},
		onSuccess: (r) => {
			if (r.ok) {
				toast.success("Destination updated");
				void queryClient.invalidateQueries({
					queryKey: ["channel", destinationId],
				});
				void queryClient.invalidateQueries({ queryKey: ["channels"] });
				return;
			}
			toast.error(r.message ?? "Could not save");
		},
	});

	const updateLinkMutation = useMutation({
		mutationFn: async (payload: {
			platform: "unlinked" | "youtube";
			externalChannelId: string | null;
			externalChannelTitle: string | null;
			externalChannelHandle: string | null;
		}) => {
			return updateChannelFn({
				data: {
					channelId: destinationId,
					...payload,
				},
			});
		},
		onSuccess: (r, variables) => {
			if (r.ok) {
				if (variables.externalChannelId === null) {
					toast.success("YouTube disconnected");
				} else {
					toast.success("Channel linked");
				}
				void queryClient.invalidateQueries({
					queryKey: ["channel", destinationId],
				});
				void queryClient.invalidateQueries({ queryKey: ["channels"] });
				return;
			}
			toast.error(r.message ?? "Could not save");
		},
	});

	const ch = channelQuery.data;

	useEffect(() => {
		if (!ch) {
			return;
		}
		setDisplayName(ch.name);
		setNiche(ch.niche);
		if (!ch.externalChannelId) {
			setPendingYtId("");
		}
	}, [ch]);

	if (channelQuery.isPending) {
		return <p className="text-sm text-muted-foreground">Loading…</p>;
	}

	if (channelQuery.isError || !ch) {
		return (
			<div className="space-y-4">
				<p className="text-sm text-destructive">Destination not found.</p>
				<Button type="button" variant="outline" asChild>
					<Link to="/dashboard/publishing">Back to publishing</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-lg space-y-8">
			<div>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="mb-4 gap-2"
					asChild
				>
					<Link to="/dashboard/publishing">
						<ArrowLeft className="size-4" />
						All destinations
					</Link>
				</Button>
			</div>

			<Card className="border-border/80">
				<CardHeader>
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<CardTitle className="font-heading text-base">
								Destination details
							</CardTitle>
							<CardDescription className="mt-1">
								Display name and niche for this publishing slot (shown in lists
								and job attribution).
							</CardDescription>
						</div>
						<Badge
							variant={
								ch.platform === "youtube" && ch.externalChannelId
									? "default"
									: "secondary"
							}
							className="shrink-0"
						>
							{ch.platform === "youtube" && ch.externalChannelId
								? "YouTube · linked"
								: "Not connected"}
						</Badge>
					</div>
				</CardHeader>
				<CardContent>
					<form
						className="space-y-4"
						onSubmit={(e) => {
							e.preventDefault();
							updateProfileMutation.mutate();
						}}
					>
						<div className="space-y-2">
							<label className="text-sm font-medium" htmlFor="dest-name">
								Name
							</label>
							<input
								id="dest-name"
								type="text"
								autoComplete="off"
								value={displayName}
								onChange={(e) => setDisplayName(e.target.value)}
								className={fieldClass}
								required
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium" htmlFor="dest-niche">
								Niche / description
							</label>
							<textarea
								id="dest-niche"
								rows={3}
								value={niche}
								onChange={(e) => setNiche(e.target.value)}
								className={cn(
									fieldClass,
									"min-h-20 resize-y py-3 leading-relaxed",
								)}
								required
							/>
						</div>
						<Button
							type="submit"
							disabled={updateProfileMutation.isPending}
							className="gap-2"
						>
							{updateProfileMutation.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : null}
							Save details
						</Button>
					</form>
				</CardContent>
			</Card>

			<Card className="border-border/80">
				<CardHeader>
					<CardTitle className="font-heading text-base">Connection</CardTitle>
					<CardDescription>
						Google / YouTube OAuth will connect your account here and fill
						channel details automatically. Manual channel id below is only until
						then.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-3">
					<Button type="button" onClick={onConnectAccount}>
						Connect account
					</Button>
				</CardContent>
			</Card>

			<Card className="border-border/80">
				<CardHeader>
					<CardTitle className="font-heading text-base">
						YouTube channel
					</CardTitle>
					<CardDescription>
						{ch.externalChannelId
							? "Linked channel id. You can’t change it here—disconnect to unlink, then reconnect the same channel (OAuth or paste the id again) when you’re ready."
							: "Paste your channel id to link this destination until OAuth is available. If you disconnected earlier, you can reconnect to the same channel. Title and handle will come from YouTube after connect."}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{ch.externalChannelId ? (
						<div className="space-y-4">
							<div className="flex flex-wrap items-center gap-2">
								<code className="rounded-md bg-muted/60 px-2 py-1 font-mono text-xs break-all text-foreground">
									{ch.externalChannelId}
								</code>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="gap-1.5"
									onClick={() => {
										const id = ch.externalChannelId;
										if (!id) return;
										void navigator.clipboard.writeText(id).then(
											() => toast.success("YouTube channel id copied"),
											() => toast.error("Could not copy"),
										);
									}}
								>
									<Copy className="size-3.5" />
									Copy
								</Button>
								<Button type="button" variant="outline" size="sm" asChild>
									<a
										href={youtubeChannelUrl(ch.externalChannelId)}
										target="_blank"
										rel="noopener noreferrer"
										className="gap-1.5"
									>
										<ExternalLink className="size-3.5" />
										Open on YouTube
									</a>
								</Button>
							</div>
							{ch.externalChannelTitle ? (
								<div>
									<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
										Channel title
									</p>
									<p className="mt-0.5 text-sm text-foreground">
										{ch.externalChannelTitle}
									</p>
								</div>
							) : null}
							<Button
								type="button"
								variant="outline"
								disabled={updateLinkMutation.isPending}
								className="gap-2"
								onClick={() => {
									if (
										typeof window !== "undefined" &&
										!window.confirm(
											"Disconnect this YouTube channel from this destination? You can reconnect to the same channel later with OAuth or by pasting the channel id again.",
										)
									) {
										return;
									}
									setPendingYtId("");
									updateLinkMutation.mutate({
										platform: "unlinked",
										externalChannelId: null,
										externalChannelTitle: null,
										externalChannelHandle: null,
									});
								}}
							>
								{updateLinkMutation.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : null}
								Disconnect YouTube
							</Button>
						</div>
					) : (
						<form
							className="space-y-4"
							onSubmit={(e) => {
								e.preventDefault();
								const idTrim = pendingYtId.trim();
								if (idTrim === "") {
									toast.error("Paste your YouTube channel id (UC…).");
									return;
								}
								updateLinkMutation.mutate({
									platform: "youtube",
									externalChannelId: idTrim,
									externalChannelTitle: null,
									externalChannelHandle: null,
								});
							}}
						>
							<div className="space-y-2">
								<label className="text-sm font-medium" htmlFor="yt-channel-id">
									Channel id (UC…)
								</label>
								<input
									id="yt-channel-id"
									type="text"
									autoComplete="off"
									spellCheck={false}
									placeholder="UCxxxxxxxxxxxxxxxxxxxxxx"
									value={pendingYtId}
									onChange={(e) => setPendingYtId(e.target.value)}
									className={fieldClass}
								/>
							</div>
							<Button
								type="submit"
								disabled={updateLinkMutation.isPending}
								className="gap-2"
							>
								{updateLinkMutation.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : null}
								Link channel
							</Button>
						</form>
					)}
				</CardContent>
			</Card>

			<Card className="border-border/80">
				<CardHeader>
					<CardTitle className="font-heading text-base">
						Klipse destination id
					</CardTitle>
					<CardDescription>
						Internal id for jobs and webhooks in this app. This is not your
						YouTube channel id.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap items-center gap-2">
					<p className="font-mono text-xs break-all text-muted-foreground">
						{ch.id}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="gap-1.5"
						onClick={() => {
							void navigator.clipboard.writeText(ch.id).then(
								() => toast.success("Destination id copied"),
								() => toast.error("Could not copy"),
							);
						}}
					>
						<Copy className="size-3.5" />
						Copy
					</Button>
				</CardContent>
			</Card>

			<Card className="border-destructive/30 bg-destructive/3 dark:bg-destructive/5">
				<CardHeader>
					<CardTitle className="font-heading text-base text-destructive">
						Remove destination
					</CardTitle>
					<CardDescription>
						Deletes this publishing destination and associated video jobs in
						this workspace.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button
						type="button"
						variant="destructive"
						className="gap-2"
						disabled={deleteMutation.isPending}
						onClick={() => {
							if (
								typeof window !== "undefined" &&
								!window.confirm(
									"Remove this publishing destination? Associated jobs in the database may be deleted.",
								)
							) {
								return;
							}
							deleteMutation.mutate();
						}}
					>
						{deleteMutation.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Trash2 className="size-4" />
						)}
						Remove
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
