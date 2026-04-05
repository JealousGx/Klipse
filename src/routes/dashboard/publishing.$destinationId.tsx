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

	const [ytId, setYtId] = useState("");
	const [ytTitle, setYtTitle] = useState("");
	const [ytHandle, setYtHandle] = useState("");

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
		onSuccess: (r) => {
			if (r.ok) {
				toast.success("Saved");
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
		setYtId(ch.externalChannelId ?? "");
		setYtTitle(ch.externalChannelTitle ?? "");
		setYtHandle(ch.externalChannelHandle ?? "");
	}, [
		ch?.externalChannelHandle,
		ch?.externalChannelId,
		ch?.externalChannelTitle,
		ch?.id,
	]);

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
				<div className="flex flex-wrap items-center gap-3">
					<h2 className="font-heading text-xl font-semibold text-foreground">
						{ch.name}
					</h2>
					<Badge
						variant={
							ch.platform === "youtube" && ch.externalChannelId
								? "default"
								: "secondary"
						}
					>
						{ch.platform === "youtube" && ch.externalChannelId
							? "YouTube · linked"
							: "Not connected"}
					</Badge>
				</div>
				<p className="mt-2 text-sm text-muted-foreground">{ch.niche}</p>
			</div>

			<Card className="border-border/80">
				<CardHeader>
					<CardTitle className="font-heading text-base">Connection</CardTitle>
					<CardDescription>
						When OAuth ships, accounts link here automatically. Until then you
						can paste your{" "}
						<strong className="font-medium text-foreground">
							YouTube channel id
						</strong>{" "}
						(<span className="font-mono">UC…</span>, from YouTube Studio →
						Channel → Advanced settings) so jobs and support can reference the
						right channel.
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
						YouTube channel id
					</CardTitle>
					<CardDescription>
						This is the platform’s id (not Klipse’s destination id below). It
						uniquely identifies your channel for uploads and analytics.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{ch.externalChannelId ? (
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
									void navigator.clipboard
										.writeText(ch.externalChannelId!)
										.then(
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
					) : null}

					<form
						className="space-y-4"
						onSubmit={(e) => {
							e.preventDefault();
							const idTrim = ytId.trim();
							if (idTrim === "") {
								updateLinkMutation.mutate({
									platform: "unlinked",
									externalChannelId: null,
									externalChannelTitle: null,
									externalChannelHandle: null,
								});
								setYtTitle("");
								setYtHandle("");
								return;
							}
							updateLinkMutation.mutate({
								platform: "youtube",
								externalChannelId: idTrim,
								externalChannelTitle: ytTitle.trim() || null,
								externalChannelHandle: ytHandle.trim() || null,
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
								value={ytId}
								onChange={(e) => setYtId(e.target.value)}
								className={fieldClass}
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium" htmlFor="yt-title">
								Channel title (optional)
							</label>
							<input
								id="yt-title"
								type="text"
								placeholder="As shown on YouTube"
								value={ytTitle}
								onChange={(e) => setYtTitle(e.target.value)}
								className={fieldClass}
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium" htmlFor="yt-handle">
								Handle (optional)
							</label>
							<input
								id="yt-handle"
								type="text"
								placeholder="@YourHandle"
								value={ytHandle}
								onChange={(e) => setYtHandle(e.target.value)}
								className={fieldClass}
							/>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								type="submit"
								disabled={updateLinkMutation.isPending}
								className="gap-2"
							>
								{updateLinkMutation.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : null}
								Save platform link
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={updateLinkMutation.isPending}
								onClick={() => {
									setYtId("");
									setYtTitle("");
									setYtHandle("");
									updateLinkMutation.mutate({
										platform: "unlinked",
										externalChannelId: null,
										externalChannelTitle: null,
										externalChannelHandle: null,
									});
								}}
							>
								Clear platform link
							</Button>
						</div>
					</form>
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

			<Card className="border-destructive/30 bg-destructive/[0.03] dark:bg-destructive/5">
				<CardHeader>
					<CardTitle className="font-heading text-base text-destructive">
						Remove destination
					</CardTitle>
					<CardDescription>
						Deletes this publishing slot and associated job rows. If you have
						none left, a default destination is created the next time you open
						Publishing.
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
