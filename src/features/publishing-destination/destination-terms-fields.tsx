import type { PlatformConfirmedTerm } from "@/features/channels/channel-config.schema"

/**
 * Display metadata for each platform-required term.
 * Add new entries here when new integrations with required terms are added —
 * no schema changes needed.
 */
const TERM_DISPLAY: Record<
	PlatformConfirmedTerm,
	{ label: string; linkText: string; linkUrl: string }
> = {
	tiktok_music_usage: {
		label: "By posting, you agree to TikTok's",
		linkText: "Music Usage Confirmation",
		linkUrl:
			"https://www.tiktok.com/legal/page/global/music-usage-confirmation/en",
	},
}

type Props = {
	requiredTerms: PlatformConfirmedTerm[]
	confirmedTerms: PlatformConfirmedTerm[]
	onConfirmTerm: (term: PlatformConfirmedTerm, checked: boolean) => void
	isConfirming: boolean
}

export function DestinationTermsFields({
	requiredTerms,
	confirmedTerms,
	onConfirmTerm,
	isConfirming,
}: Props) {
	if (requiredTerms.length === 0) return null

	const confirmedSet = new Set(confirmedTerms)

	return (
		<div className="space-y-3">
			<div>
				<p className="text-sm font-medium text-foreground">
					Required confirmations
				</p>
				<p className="mt-1 text-sm text-muted-foreground">
					Publishing to this platform requires you to confirm the following.
					Approval will be blocked until all boxes are checked.
				</p>
			</div>

			<div className="space-y-2">
				{requiredTerms.map((term) => {
					const display = TERM_DISPLAY[term]
					const checked = confirmedSet.has(term)
					return (
						<label
							key={term}
							className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
						>
							<input
								type="checkbox"
								className="mt-0.5 shrink-0"
								checked={checked}
								disabled={isConfirming}
								onChange={(e) => onConfirmTerm(term, e.target.checked)}
							/>
							<span className="text-sm leading-relaxed text-foreground">
								{display.label}{" "}
								<a
									href={display.linkUrl}
									target="_blank"
									rel="noreferrer"
									className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
									onClick={(e) => e.stopPropagation()}
								>
									{display.linkText}
								</a>
							</span>
						</label>
					)
				})}
			</div>
		</div>
	)
}
