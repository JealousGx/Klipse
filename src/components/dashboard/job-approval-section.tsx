import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { getTiktokPublishOptionsFn } from "@/features/publishing/tiktok/tiktok-publish.functions"
import type { VideoJobListRow } from "@/features/video/video-job-list.types"
import { platformDisplayName } from "@/lib/platform-publishing"

/**
 * Per-video privacy picker + commercial disclosure for TikTok.
 * Disabled pending TikTok Direct Post API audit approval.
 * Re-enable: flip this to `true`.
 */
const TIKTOK_PER_VIDEO_CONTROLS_ENABLED = false

/** Maps TikTok privacy level keys to human-readable labels. */
function tiktokPrivacyLabel(level: string): string {
	switch (level) {
		case "PUBLIC_TO_EVERYONE":
			return "Public"
		case "FOLLOWER_OF_CREATOR":
			return "Followers only"
		case "MUTUAL_FOLLOW_FRIENDS":
			return "Friends"
		case "SELF_ONLY":
			return "Private (only me)"
		default:
			return level
	}
}

/** Caption limit per platform (combined description + hashtags). */
const CAPTION_LIMIT: Partial<Record<string, number>> = { tiktok: 2200 }
const DEFAULT_CAPTION_LIMIT = 5000

function buildInitialCaption(artifacts: VideoJobListRow["artifacts"]): string {
	const desc = artifacts?.description?.trim() ?? ""
	const tags = (artifacts?.tags ?? [])
		.map((t) => `#${t.replace(/\s+/g, "").replace(/[^a-zA-Z0-9_]/g, "")}`)
		.filter((t) => t.length > 1)
		.join(" ")
	return [desc, tags].filter(Boolean).join("\n\n")
}

type Props = {
	job: VideoJobListRow
	retentionNote: string
	onDecision: (
		decision: "approved" | "rejected",
		opts: {
			captionOverride?: string
			publishSettings?: {
				privacyLevel?: string
				tiktokDisclosure?: {
					enabled: boolean
					brandOrganic: boolean
					brandedContent: boolean
				}
			}
		},
	) => void
	isPending: boolean
}

export function JobApprovalSection({
	job,
	retentionNote,
	onDecision,
	isPending,
}: Props) {
	const isTiktok = job.channelPlatform === "tiktok"
	const captionLimit =
		CAPTION_LIMIT[job.channelPlatform] ?? DEFAULT_CAPTION_LIMIT

	// Caption
	const [captionDraft, setCaptionDraft] = useState(() =>
		buildInitialCaption(job.artifacts),
	)

	// Privacy + disclosure state — kept for when TIKTOK_PER_VIDEO_CONTROLS_ENABLED is re-enabled
	const [selectedPrivacy, setSelectedPrivacy] = useState<string>("")
	const [disclosureEnabled, setDisclosureEnabled] = useState(false)
	const [brandOrganic, setBrandOrganic] = useState(false)
	const [brandedContent, setBrandedContent] = useState(false)

	// Fetch TikTok creator info — only active when per-video controls are enabled
	const tiktokOptionsQuery = useQuery({
		queryKey: ["tiktok-publish-options", job.channelId],
		queryFn: () =>
			getTiktokPublishOptionsFn({ data: { channelId: job.channelId } }),
		enabled: isTiktok && TIKTOK_PER_VIDEO_CONTROLS_ENABLED,
		staleTime: 5 * 60 * 1000,
	})

	const privacyOptions =
		TIKTOK_PER_VIDEO_CONTROLS_ENABLED && isTiktok && tiktokOptionsQuery.data?.ok
			? tiktokOptionsQuery.data.privacyLevelOptions
			: []

	// Which account is posting
	const accountLabel = (() => {
		const handle = job.channelExternalHandle
			? `@${job.channelExternalHandle}`
			: null
		const title = job.channelExternalTitle ?? null
		const ident = handle ?? title
		return ident
			? `Posting to ${ident} on ${platformDisplayName(job.channelPlatform)}`
			: `Posting to ${platformDisplayName(job.channelPlatform)}`
	})()

	// Declaration — always shows Music Usage for TikTok; Branded Content Policy only
	// when per-video disclosure controls are enabled and the user has selected branded content.
	const declarationNode = isTiktok ? (
		<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
			By posting, you agree to TikTok&rsquo;s{" "}
			{TIKTOK_PER_VIDEO_CONTROLS_ENABLED &&
			brandedContent &&
			disclosureEnabled ? (
				<>
					<a
						href="https://www.tiktok.com/legal/page/global/bc-policy/en"
						target="_blank"
						rel="noreferrer"
						className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
					>
						Branded Content Policy
					</a>{" "}
					and{" "}
				</>
			) : null}
			<a
				href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
				target="_blank"
				rel="noreferrer"
				className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
			>
				Music Usage Confirmation
			</a>
			.
		</p>
	) : null

	// Approve disabled conditions — privacy + disclosure gates only when controls are on
	const privacyRequired =
		TIKTOK_PER_VIDEO_CONTROLS_ENABLED && isTiktok && !selectedPrivacy
	const disclosureIncomplete =
		TIKTOK_PER_VIDEO_CONTROLS_ENABLED &&
		isTiktok &&
		disclosureEnabled &&
		!brandOrganic &&
		!brandedContent
	const approveDisabled = isPending || privacyRequired || disclosureIncomplete

	function handleDecision(decision: "approved" | "rejected") {
		onDecision(decision, {
			captionOverride: captionDraft.trim() || undefined,
			publishSettings: TIKTOK_PER_VIDEO_CONTROLS_ENABLED
				? {
						privacyLevel: selectedPrivacy || undefined,
						...(isTiktok
							? {
									tiktokDisclosure: {
										enabled: disclosureEnabled,
										brandOrganic,
										brandedContent,
									},
								}
							: {}),
					}
				: undefined,
		})
	}

	return (
		<div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-foreground">
			<p className="font-medium">Your call before anything goes live</p>
			<p className="mt-0.5 text-xs text-muted-foreground">{accountLabel}</p>
			<p className="mt-1 text-xs text-muted-foreground">
				This destination is set to ask you first. Approve or reject below.
			</p>
			<p className="mt-2 rounded-md border border-amber-600/25 bg-amber-500/5 px-2.5 py-2 text-xs leading-relaxed text-amber-950 dark:text-amber-100/95">
				{retentionNote}
			</p>

			{/* Caption */}
			<div className="mt-3">
				<label className="block">
					<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						Caption
					</span>
					<textarea
						value={captionDraft}
						onChange={(e) => setCaptionDraft(e.target.value)}
						maxLength={captionLimit}
						rows={5}
						className="mt-1 w-full resize-y rounded-md border border-border bg-background px-2.5 py-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
						placeholder="Caption and hashtags…"
						disabled={isPending}
					/>
				</label>
				<p className="mt-0.5 text-right text-[10px] text-muted-foreground">
					{captionDraft.length} / {captionLimit}
				</p>
			</div>

			{/* Privacy picker — TikTok only, required. Disabled pending Direct Post audit. */}
			{TIKTOK_PER_VIDEO_CONTROLS_ENABLED && isTiktok ? (
				<div className="mt-3">
					<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						Who can view this video
					</p>
					{tiktokOptionsQuery.isPending ? (
						<div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
							<Loader2 className="size-3 animate-spin" />
							Loading account options…
						</div>
					) : tiktokOptionsQuery.data && !tiktokOptionsQuery.data.ok ? (
						<p className="mt-1 text-xs text-destructive">
							{tiktokOptionsQuery.data.code === "post_cap_reached"
								? "Daily post limit reached — try again tomorrow."
								: "Could not load visibility options. Check your TikTok connection."}
						</p>
					) : (
						<Select
							value={selectedPrivacy}
							onValueChange={setSelectedPrivacy}
							disabled={isPending || privacyOptions.length === 0}
						>
							<SelectTrigger
								size="sm"
								className="mt-1 w-full text-xs"
								aria-label="Who can view this video"
							>
								<SelectValue placeholder="Select visibility…" />
							</SelectTrigger>
							<SelectContent>
								{privacyOptions.map((level) => (
									<SelectItem
										key={level}
										value={level}
										// Branded content cannot be private
										disabled={
											level === "SELF_ONLY" &&
											disclosureEnabled &&
											brandedContent
										}
									>
										{tiktokPrivacyLabel(level)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
					{privacyRequired && selectedPrivacy === "" ? (
						<p className="mt-0.5 text-[10px] text-destructive">
							Visibility selection is required before approving.
						</p>
					) : null}
				</div>
			) : null}

			{/* Commercial content disclosure — TikTok only. Disabled pending Direct Post audit. */}
			{TIKTOK_PER_VIDEO_CONTROLS_ENABLED && isTiktok ? (
				<div className="mt-3 space-y-2">
					<label className="flex cursor-pointer items-start gap-2.5">
						<input
							type="checkbox"
							className="mt-0.5 shrink-0"
							checked={disclosureEnabled}
							disabled={isPending}
							onChange={(e) => {
								setDisclosureEnabled(e.target.checked)
								if (!e.target.checked) {
									setBrandOrganic(false)
									setBrandedContent(false)
								}
							}}
						/>
						<span className="text-xs leading-relaxed text-foreground">
							<span className="font-medium">Disclose video content</span>
							<span className="ml-1 text-muted-foreground">
								— indicate if this promotes a brand, product, or service
							</span>
						</span>
					</label>

					{disclosureEnabled ? (
						<div className="ml-5 space-y-1.5 rounded-md border border-border bg-background px-3 py-2.5">
							<label className="flex cursor-pointer items-start gap-2.5">
								<input
									type="checkbox"
									className="mt-0.5 shrink-0"
									checked={brandOrganic}
									disabled={isPending}
									onChange={(e) => setBrandOrganic(e.target.checked)}
								/>
								<span className="text-xs leading-relaxed text-foreground">
									<span className="font-medium">Your brand</span>
									<span className="ml-1 text-muted-foreground">
										— you promote yourself or your own business
									</span>
								</span>
							</label>
							<label className="flex cursor-pointer items-start gap-2.5">
								<input
									type="checkbox"
									className="mt-0.5 shrink-0"
									checked={brandedContent}
									disabled={isPending}
									onChange={(e) => {
										setBrandedContent(e.target.checked)
										// If branded content enabled and SELF_ONLY selected, clear it
										if (e.target.checked && selectedPrivacy === "SELF_ONLY") {
											setSelectedPrivacy("")
										}
									}}
								/>
								<span className="text-xs leading-relaxed text-foreground">
									<span className="font-medium">Branded content</span>
									<span className="ml-1 text-muted-foreground">
										— you promote another brand or a third party
									</span>
								</span>
							</label>
							{disclosureIncomplete ? (
								<p className="text-[10px] text-destructive">
									Select at least one option to proceed.
								</p>
							) : null}
							{brandedContent || brandOrganic ? (
								<p className="text-[10px] text-muted-foreground">
									Your video will be labeled as &ldquo;
									{brandedContent ? "Paid partnership" : "Promotional content"}
									&rdquo;
								</p>
							) : null}
						</div>
					) : null}
				</div>
			) : null}

			{/* Declaration */}
			{declarationNode}

			{/* Approve / Reject */}
			<div className="mt-3 flex flex-wrap gap-2">
				<Button
					type="button"
					size="sm"
					className="h-8 text-xs font-semibold"
					disabled={approveDisabled}
					onClick={() => handleDecision("approved")}
				>
					{isPending ? (
						<>
							<Loader2 className="mr-1.5 size-3 animate-spin" />
							Saving…
						</>
					) : (
						"Approve publish"
					)}
				</Button>
				<Button
					type="button"
					size="sm"
					variant="outline"
					className="h-8 text-xs font-semibold"
					disabled={isPending}
					onClick={() => handleDecision("rejected")}
				>
					Reject
				</Button>
			</div>
		</div>
	)
}
