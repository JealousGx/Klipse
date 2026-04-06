type DestinationAutoPostFieldsProps = {
	/** Mirrors `channels.config.auto_post`: publish without asking when the pipeline is ready. */
	autoPost: boolean;
	onAutoPostChange: (next: boolean) => void;
	disabled: boolean;
	disabledReason?: string;
	isSaving: boolean;
};

export function DestinationAutoPostFields({
	autoPost,
	onAutoPostChange,
	disabled,
	disabledReason,
	isSaving,
}: DestinationAutoPostFieldsProps) {
	const groupName = "destination-auto-post";

	return (
		<div className="space-y-3">
			<div>
				<p className="text-sm font-medium text-foreground">
					When a video is ready
				</p>
				<p className="mt-1 text-sm text-muted-foreground">
					Choose whether Klipse must ask you before publishing to your connected
					channel, or may publish on your behalf once rendering is complete.
				</p>
			</div>

			{disabled && disabledReason ? (
				<p className="text-sm text-muted-foreground">{disabledReason}</p>
			) : null}

			<fieldset
				disabled={disabled || isSaving}
				className="space-y-3 border-0 p-0"
			>
				<legend className="sr-only">Publishing mode after render</legend>

				<label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
					<input
						type="radio"
						name={groupName}
						className="mt-1"
						checked={!autoPost}
						onChange={() => onAutoPostChange(false)}
					/>
					<span>
						<span className="font-medium text-foreground">
							Ask before publishing
						</span>
						<span className="mt-0.5 block text-sm text-muted-foreground">
							We email you and show the job in Jobs — you confirm or reject before
							anything is published.
						</span>
					</span>
				</label>

				<label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
					<input
						type="radio"
						name={groupName}
						className="mt-1"
						checked={autoPost}
						onChange={() => onAutoPostChange(true)}
					/>
					<span>
						<span className="font-medium text-foreground">Auto-publish</span>
						<span className="mt-0.5 block text-sm text-muted-foreground">
							Do not ask each time — publish when the pipeline is ready (paid
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
	);
}
