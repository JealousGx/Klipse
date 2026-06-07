import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type DestinationSoundFieldsProps = {
	soundEnabled: boolean
	onSoundEnabledChange: (next: boolean) => void
	soundPromptHint: string
	onSoundPromptHintChange: (next: string) => void
	onSavePromptHint: () => void
	isSavingEnabled: boolean
	isSavingHint: boolean
	/** Creator+ required — when false, controls are disabled with a reason. */
	canUseSoundGeneration: boolean
}

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
					at 30% volume. Requires Creator plan or higher and ElevenLabs API keys
					configured by an admin.
				</p>
			</div>

			{!canUseSoundGeneration ? (
				<p className="text-sm text-muted-foreground">
					Upgrade to Creator or higher to enable AI background sound on this
					destination.
				</p>
			) : null}

			<Label
				htmlFor="sound-enabled"
				className="flex cursor-pointer items-center gap-3"
			>
				<input
					id="sound-enabled"
					type="checkbox"
					className="size-4 rounded border-border"
					checked={soundEnabled}
					disabled={!canUseSoundGeneration || isSavingEnabled}
					onChange={(e) => onSoundEnabledChange(e.target.checked)}
					aria-describedby="sound-enabled-hint"
				/>
				<span>Enable background sound for this destination</span>
			</Label>
			<p id="sound-enabled-hint" className="sr-only">
				Ambient sound plays under the voiceover at 30% volume. Creator plan
				required.
			</p>

			{isSavingEnabled ? (
				<p className="text-xs text-muted-foreground" aria-live="polite">
					Saving…
				</p>
			) : null}

			{soundEnabled && canUseSoundGeneration ? (
				<div className="space-y-2">
					<Label htmlFor="sound-prompt-hint">
						Sound prompt hint{" "}
						<span className="font-normal text-muted-foreground">
							(optional)
						</span>
					</Label>
					<p
						id="sound-prompt-hint-desc"
						className="text-xs text-muted-foreground"
					>
						Describe the sound style, e.g. "calm ambient piano" or "upbeat
						electronic". Leave blank to auto-generate from your channel niche
						and tone.
					</p>
					<div className="flex gap-2">
						<Input
							id="sound-prompt-hint"
							type="text"
							placeholder="e.g. calm ambient background music"
							maxLength={255}
							value={soundPromptHint}
							onChange={(e) => onSoundPromptHintChange(e.target.value)}
							disabled={isSavingHint}
							aria-describedby="sound-prompt-hint-desc"
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onSavePromptHint}
							disabled={isSavingHint}
						>
							{isSavingHint ? "Saving…" : "Save"}
						</Button>
					</div>
				</div>
			) : null}
		</div>
	)
}
