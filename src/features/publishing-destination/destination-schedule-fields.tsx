import type { ChannelConfig } from "@/features/channels/channel-config.schema";
import { CalendarClock, FastForward, Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";

type ScheduleInfo = {
	nextRunAt: Date;
	frequency: ChannelConfig["posting_frequency"];
	enabled: boolean;
} | null;

type Props = {
	schedule: ScheduleInfo;
	onPause: () => void;
	onResume: () => void;
	isPausing: boolean;
	isResuming: boolean;
	/** Creator+ only — if false, button is shown but disabled with upgrade hint. */
	canTriggerNow: boolean;
	onTriggerNow: () => void;
	isTriggeringNow: boolean;
};

const FREQUENCY_LABEL: Record<ChannelConfig["posting_frequency"], string> = {
	daily: "Generating daily",
	every_2_days: "Generating every 2 days",
	every_3_days: "Generating every 3 days",
	every_4_days: "Generating every 4 days",
	every_5_days: "Generating every 5 days",
	every_6_days: "Generating every 6 days",
	weekly: "Generating weekly",
	every_2_weeks: "Generating every 2 weeks",
	every_3_weeks: "Generating every 3 weeks",
	monthly: "Generating monthly",
};

function formatNextRun(date: Date): string {
	return date.toLocaleString(undefined, {
		weekday: "long",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

export function DestinationScheduleFields({
	schedule,
	onPause,
	onResume,
	isPausing,
	isResuming,
	canTriggerNow,
	onTriggerNow,
	isTriggeringNow,
}: Props) {
	if (!schedule) {
		return (
			<p className="text-sm text-muted-foreground">
				No schedule set up yet. Update your channel's posting frequency to
				activate automated generation.
			</p>
		);
	}

	const frequencyLabel = FREQUENCY_LABEL[schedule.frequency] ?? "Generating on schedule";

	if (!schedule.enabled) {
		return (
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50">
						<Pause className="size-4 text-muted-foreground" />
					</div>
					<div>
						<p className="text-sm font-medium text-foreground">
							Schedule paused
						</p>
						<p className="text-xs text-muted-foreground">
							No videos will be generated automatically until you resume.
						</p>
					</div>
				</div>
				<Button
					type="button"
					size="sm"
					className="gap-2 self-start sm:self-auto"
					disabled={isResuming}
					onClick={onResume}
				>
					<Play className="size-3.5" />
					{isResuming ? "Resuming…" : "Resume schedule"}
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/8">
						<CalendarClock className="size-4 text-primary" />
					</div>
					<div>
						<p className="text-sm font-medium text-foreground">
							Next video:{" "}
							<span className="text-foreground">
								{formatNextRun(new Date(schedule.nextRunAt))}
							</span>
						</p>
						<p className="text-xs text-muted-foreground">{frequencyLabel}</p>
					</div>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="gap-2 self-start sm:self-auto"
					disabled={isPausing}
					onClick={onPause}
				>
					<Pause className="size-3.5" />
					{isPausing ? "Pausing…" : "Pause schedule"}
				</Button>
			</div>

			{/* Fast-forward: generate now + advance schedule */}
			<div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p className="text-sm font-medium text-foreground">Generate now</p>
					<p className="text-xs text-muted-foreground">
						{canTriggerNow
							? "Trigger the next video immediately and advance your schedule."
							: "Upgrade to Creator or higher to generate on demand."}
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="gap-2 self-start sm:self-auto"
					disabled={!canTriggerNow || isTriggeringNow}
					onClick={canTriggerNow ? onTriggerNow : undefined}
					title={
						!canTriggerNow
							? "Requires Creator plan or higher"
							: "Generate a video now and advance your schedule"
					}
				>
					<FastForward className="size-3.5" />
					{isTriggeringNow ? "Generating…" : "Generate now"}
				</Button>
			</div>
		</div>
	);
}
