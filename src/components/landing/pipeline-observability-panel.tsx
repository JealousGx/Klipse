import { Activity, BarChart3, RefreshCw, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const rows = [
	{
		icon: Activity,
		label: "Active jobs",
		value: "4 in queue",
		badge: "Live" as const,
	},
	{
		icon: BarChart3,
		label: "Stage latency (p50)",
		value: "2m 14s",
		badge: "Healthy" as const,
	},
	{
		icon: RefreshCw,
		label: "Retries today",
		value: "12 recovered",
		badge: "Auto" as const,
	},
	{
		icon: ShieldCheck,
		label: "Disclosure & platform rules",
		value: "Validated pre-publish",
		badge: "OK" as const,
	},
] as const;

/** Complements the narrative column in “Your whole pipeline, visible”. */
export function PipelineObservabilityPanel() {
	return (
		<Card className="h-full border-border/70 bg-card/90 shadow-lg shadow-black/3 ring-1 ring-border/35 backdrop-blur-sm dark:bg-card/65 dark:shadow-black/25">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 font-heading text-lg">
					<Activity className="size-5 shrink-0 text-primary" aria-hidden />
					Operator visibility
				</CardTitle>
				<CardDescription>
					Signals you would wire alerts on—job health, latency, retries, and
					compliance checks.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-0">
				{rows.map((row, i) => {
					const Icon = row.icon;
					return (
						<div key={row.label}>
							{i > 0 ? <Separator className="my-4" /> : null}
							<div className="flex gap-3">
								<div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-linear-to-br from-muted/60 to-muted/30 text-primary shadow-sm">
									<Icon className="size-4" aria-hidden />
								</div>
								<div className="min-w-0 flex-1">
									<p className="text-xs font-medium text-muted-foreground">
										{row.label}
									</p>
									<p className="mt-0.5 font-medium text-foreground">
										{row.value}
									</p>
								</div>
								<Badge variant="secondary" className="h-fit shrink-0">
									{row.badge}
								</Badge>
							</div>
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}
