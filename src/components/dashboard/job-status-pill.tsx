import type { VideoJobListRow } from "@/features/video/video-job-list.types";

import { cn } from "@/lib/utils";

import { statusLabel } from "./utils";

export function JobStatusPill({
	status,
}: {
	status: VideoJobListRow["status"];
}) {
	const base =
		"rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
	const styles: Record<VideoJobListRow["status"], string> = {
		queued: "border-border text-muted-foreground",
		dispatched:
			"border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
		processing: "border-primary/40 bg-primary/10 text-primary",
		completed: "border-border bg-muted text-foreground",
		failed: "border-destructive/40 bg-destructive/10 text-destructive",
	};
	return (
		<span className={cn(base, styles[status])}>{statusLabel[status]}</span>
	);
}
