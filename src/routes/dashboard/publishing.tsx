import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Pencil, Trash2 } from "lucide-react";
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

import { deleteChannelFn } from "@/features/channels/channels.functions";
import { channelsQueryOptions } from "@/lib/queries/dashboard-queries";
import { youtubeChannelUrl } from "@/lib/youtube";

export const Route = createFileRoute("/dashboard/publishing")({
	staticData: { dashboardTitle: "Publishing" },
	component: PublishingPage,
});

function PublishingPage() {
	const queryClient = useQueryClient();
	const destinationsQuery = useQuery(channelsQueryOptions);

	const deleteMutation = useMutation({
		mutationFn: (channelId: string) => deleteChannelFn({ data: { channelId } }),
		onSuccess: (r) => {
			if (r.ok) {
				toast.success("Destination removed");
				void queryClient.invalidateQueries({ queryKey: ["channels"] });
				void queryClient.invalidateQueries({ queryKey: ["video-jobs"] });
				return;
			}
			toast.error("Couldn’t remove destination");
		},
	});

	const loading = destinationsQuery.isPending;
	const list = destinationsQuery.data ?? [];

	const onConnectAccount = () => {
		toast.info("Account linking is on the roadmap", {
			description:
				"YouTube is the first publishing integration we’re wiring up; TikTok, Instagram, and others follow the same destination model—no rewrite required.",
		});
	};

	return (
		<div className="space-y-8">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 className="font-heading text-lg font-semibold text-foreground">
						Publishing & connections
					</h2>
					<p className="mt-1 max-w-xl text-sm text-muted-foreground">
						Each{" "}
						<strong className="font-medium text-foreground">destination</strong>{" "}
						is where finished videos go live—starting with{" "}
						<strong className="font-medium text-foreground">YouTube</strong>,
						with additional platforms added over time using the same pipeline.
						You authorize Klipse once per account; we upload on your behalf
						after you approve in the app.
					</p>
				</div>
				<Button
					type="button"
					className="shrink-0 gap-2"
					onClick={onConnectAccount}
				>
					Connect account
				</Button>
			</div>

			<Card className="border-primary/25 bg-primary/4 dark:bg-primary/10">
				<CardHeader className="pb-2">
					<CardTitle className="font-heading text-base">
						Extensible by design
					</CardTitle>
					<CardDescription className="text-pretty">
						Destinations are platform-agnostic in the product model: today’s
						stub IDs become OAuth-backed connectors. New platforms plug in as
						new connector types—not separate products.
					</CardDescription>
				</CardHeader>
			</Card>

			<div>
				<h3 className="text-sm font-semibold text-foreground">
					Publishing destinations
				</h3>
				<p className="mt-1 text-sm text-muted-foreground">
					Each row is a publishing destination. When a platform is linked, we
					show its channel id (e.g. YouTube{" "}
					<span className="font-mono">UC…</span>) for uploads and
					analytics—distinct from Klipse’s internal id below.
				</p>
			</div>

			{loading ? (
				<p className="text-sm text-muted-foreground">Loading…</p>
			) : list.length === 0 ? (
				<Card className="border-dashed border-border/80 bg-muted/10">
					<CardContent className="py-10 text-center text-sm text-muted-foreground">
						No destinations yet. This shouldn’t happen — refresh, or contact
						support.
					</CardContent>
				</Card>
			) : (
				<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{list.map((ch) => {
						const ytLinked =
							ch.platform === "youtube" && Boolean(ch.externalChannelId);
						return (
							<li
								key={ch.id}
								className="rounded-xl border border-border/80 bg-card/40 p-5 transition-colors hover:border-primary/35 hover:bg-muted/20"
							>
								<div className="flex items-start justify-between gap-2">
									<Link
										to="/dashboard/publishing/$destinationId"
										params={{ destinationId: ch.id }}
										className="font-heading text-base font-semibold text-foreground hover:underline"
									>
										{ch.name}
									</Link>
									<Badge
										variant={ytLinked ? "default" : "secondary"}
										className="shrink-0 text-[10px]"
									>
										{ytLinked ? "YouTube · linked" : "Not connected"}
									</Badge>
								</div>
								<p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
									{ch.externalChannelTitle ?? ch.niche}
								</p>
								{ch.externalChannelId ? (
									<div className="mt-3 flex flex-wrap items-center gap-2">
										<code className="rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
											{ch.externalChannelId}
										</code>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="h-7 text-xs"
											onClick={() => {
												void navigator.clipboard
													.writeText(ch.externalChannelId as string)
													.then(
														() => toast.success("YouTube channel id copied"),
														() => toast.error("Could not copy"),
													);
											}}
										>
											Copy id
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-7 text-xs"
											asChild
										>
											<a
												href={youtubeChannelUrl(ch.externalChannelId)}
												target="_blank"
												rel="noopener noreferrer"
											>
												Open on YouTube
											</a>
										</Button>
									</div>
								) : null}
								<p className="mt-3 text-[10px] text-muted-foreground">
									<span className="font-medium text-foreground/80">
										Klipse destination id
									</span>
									<br />
									<code className="font-mono">{ch.id}</code>
								</p>
								<div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
									<Button
										variant="outline"
										size="sm"
										className="gap-1.5"
										asChild
									>
										<Link
											to="/dashboard/publishing/$destinationId"
											params={{ destinationId: ch.id }}
										>
											<Pencil className="size-3.5" aria-hidden />
											Edit
										</Link>
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
										disabled={deleteMutation.isPending}
										onClick={() => {
											if (
												typeof window !== "undefined" &&
												!window.confirm(
													"Remove this publishing destination? Associated video jobs may be deleted.",
												)
											) {
												return;
											}
											deleteMutation.mutate(ch.id);
										}}
									>
										{deleteMutation.isPending &&
										deleteMutation.variables === ch.id ? (
											<Loader2 className="size-3.5 animate-spin" aria-hidden />
										) : (
											<Trash2 className="size-3.5" aria-hidden />
										)}
										Remove
									</Button>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
