import { Info } from "lucide-react"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip"

type DestinationAutoPostFieldsProps = {
	/** Mirrors `channels.config.auto_post`: publish without asking when the pipeline is ready. */
	autoPost: boolean
	onAutoPostChange: (next: boolean) => void
	disabled: boolean
	disabledReason?: string
	isSaving: boolean
	/**
	 * When set, the entire control is locked — radios are disabled and "Ask before publishing"
	 * is forced. A tooltip icon beside the section title explains why.
	 * Used for platforms like TikTok that always require manual review.
	 */
	lockedReason?: string
}

export function DestinationAutoPostFields({
	autoPost,
	onAutoPostChange,
	disabled,
	disabledReason,
	isSaving,
	lockedReason,
}: DestinationAutoPostFieldsProps) {
	const groupName = "destination-auto-post"
	const isLocked = Boolean(lockedReason)

	return (
		<div className="space-y-3">
			<div>
				<span className="flex items-center gap-1.5">
					<p className="text-sm font-medium text-foreground">
						When a video is ready
					</p>
					{lockedReason ? (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										type="button"
										className="inline-flex items-center text-muted-foreground hover:text-foreground"
										aria-label="Why is this locked?"
									>
										<Info className="size-3.5" aria-hidden />
									</button>
								</TooltipTrigger>
								<TooltipContent side="top" className="max-w-60 text-center">
									{lockedReason}
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					) : null}
				</span>
				<p className="mt-1 text-sm text-muted-foreground">
					Choose whether Klipse must ask you before publishing to your connected
					channel, or may publish on your behalf once your video is ready.
				</p>
			</div>

			{disabled && !isLocked && disabledReason ? (
				<p className="text-sm text-muted-foreground">{disabledReason}</p>
			) : null}

			<fieldset
				disabled={disabled || isLocked || isSaving}
				className="space-y-3 border-0 p-0"
			>
				<legend className="sr-only">
					Publishing mode when your video is ready
				</legend>

				<label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
					<input
						type="radio"
						name={groupName}
						className="mt-1"
						checked={isLocked ? true : !autoPost}
						onChange={() => onAutoPostChange(false)}
					/>
					<span>
						<span className="font-medium text-foreground">
							Ask before publishing
						</span>
						<span className="mt-0.5 block text-sm text-muted-foreground">
							We email you and show the job in Jobs — you confirm or reject
							before anything is published.
						</span>
					</span>
				</label>

				<label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
					<input
						type="radio"
						name={groupName}
						className="mt-1"
						checked={isLocked ? false : autoPost}
						onChange={() => onAutoPostChange(true)}
					/>
					<span>
						<span className="font-medium text-foreground">Auto-publish</span>
						<span className="mt-0.5 block text-sm text-muted-foreground">
							Do not ask each time — publish when your video is ready (paid
							publishing).
						</span>
					</span>
				</label>
			</fieldset>

			{isSaving ? (
				<p className="text-xs text-muted-foreground" aria-live="polite">
					Saving…
				</p>
			) : null}
		</div>
	)
}
