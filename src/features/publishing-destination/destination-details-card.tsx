import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { publishingDestinationFieldClass } from "./publishing-destination-field-class"

type Props = {
	oauthConnected: boolean
	displayName: string
	niche: string
	onDisplayNameChange: (value: string) => void
	onNicheChange: (value: string) => void
	onSave: () => void
	isSaving: boolean
}

export function DestinationDetailsFields({
	oauthConnected,
	displayName,
	niche,
	onDisplayNameChange,
	onNicheChange,
	onSave,
	isSaving,
}: Props) {
	return (
		<div className="space-y-5">
			<form
				className="space-y-4"
				onSubmit={(e) => {
					e.preventDefault()
					onSave()
				}}
			>
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="dest-name">
						Name in Klipse
					</label>
					<p
						id="dest-name-hint"
						className="text-xs leading-relaxed text-muted-foreground"
					>
						For lists and pickers in this app only. This is{" "}
						<strong className="font-medium text-foreground">not</strong> your
						platform channel title
						{oauthConnected
							? "—that appears in the connected channel section below."
							: "—after you connect your account, it appears in the connected channel section."}
					</p>
					<input
						id="dest-name"
						aria-describedby="dest-name-hint"
						type="text"
						autoComplete="off"
						value={displayName}
						onChange={(e) => onDisplayNameChange(e.target.value)}
						className={publishingDestinationFieldClass}
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
						maxLength={500} // Arbitrary limit to prevent excessively long text, can be adjusted later if needed
						value={niche}
						onChange={(e) => onNicheChange(e.target.value)}
						className={cn(
							publishingDestinationFieldClass,
							"min-h-20 resize-y py-3 leading-relaxed",
						)}
						required
					/>
				</div>
				<Button type="submit" disabled={isSaving} className="gap-2">
					{isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
					Save details
				</Button>
			</form>
		</div>
	)
}
