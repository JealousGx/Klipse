type DestinationSoundFieldsProps = {
	soundEnabled: boolean;
	onSoundEnabledChange: (next: boolean) => void;
	soundPromptHint: string;
	onSoundPromptHintChange: (next: string) => void;
	onSavePromptHint: () => void;
	isSavingEnabled: boolean;
	isSavingHint: boolean;
	/** Creator+ required — when false, controls are disabled with a reason. */
	canUseSoundGeneration: boolean;
};

export function DestinationSoundFields({
	soundEnabled,
	onSoundEnabledChange,
	soundPromptHint,
	onSoundPromptHintChange,
	onSavePromptHint,
	isSavingEnabled,
	isSavingHint,
	canUseSoundGeneration,
}: DestinationSoundFieldsProps) {
	return (
		<div className="space-y-4">
			<div>
				<p className="text-sm font-medium text-foreground">
					AI background sound
				</p>
				<p className="mt-1 text-sm text-muted-foreground">
					Generate a short ambient sound effect that plays under the voiceover
					at 30% volume. Requires Creator plan or higher and ElevenLabs API
					keys configured by an admin.
				</p>
			</div>

			{!canUseSoundGeneration ? (
				<p className="text-sm text-muted-foreground">
					Upgrade to Creator or higher to enable AI background sound on this
					destination.
				</p>
			) : null}

			<label className="flex cursor-pointer items-center gap-3">
				<input
					type="checkbox"
					className="size-4 rounded border-border"
					checked={soundEnabled}
					disabled={!canUseSoundGeneration || isSavingEnabled}
					onChange={(e) => onSoundEnabledChange(e.target.checked)}
				/>
				<span className="text-sm font-medium text-foreground">
					Enable background sound for this destination
				</span>
			</label>

			{soundEnabled && canUseSoundGeneration ? (
				<div className="space-y-2">
					<p className="text-sm font-medium text-foreground">
						Sound prompt hint{" "}
						<span className="font-normal text-muted-foreground">(optional)</span>
					</p>
					<p className="text-xs text-muted-foreground">
						Describe the sound style, e.g. "calm ambient piano" or "upbeat
						electronic". Leave blank to auto-generate from your channel niche and
						tone.
					</p>
					<div className="flex gap-2">
						<input
							type="text"
							className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
							placeholder="e.g. calm ambient background music"
							maxLength={255}
							value={soundPromptHint}
							onChange={(e) => onSoundPromptHintChange(e.target.value)}
							disabled={isSavingHint}
						/>
						<button
							type="button"
							className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
							onClick={onSavePromptHint}
							disabled={isSavingHint}
						>
							{isSavingHint ? "Saving…" : "Save"}
						</button>
					</div>
				</div>
			) : null}

			{isSavingEnabled ? (
				<p className="text-xs text-muted-foreground" aria-live="polite">
					Saving…
				</p>
			) : null}
		</div>
	);
}
