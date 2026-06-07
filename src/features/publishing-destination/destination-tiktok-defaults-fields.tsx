import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type { ChannelConfig } from "@/features/channels/channel-config.schema"
import { getTiktokPublishOptionsFn } from "@/features/publishing/tiktok/tiktok-publish.functions"

type TiktokDisclosure = NonNullable<ChannelConfig["tiktok_disclosure"]>

type Props = {
	channelId: string
	privacyLevel: string | undefined
	disclosure: TiktokDisclosure | undefined
	onPrivacyLevelChange: (level: string) => void
	onDisclosureChange: (d: TiktokDisclosure) => void
}

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

export function DestinationTiktokDefaultsFields({
	channelId,
	privacyLevel,
	disclosure,
	onPrivacyLevelChange,
	onDisclosureChange,
}: Props) {
	// Local state for immediate UI feedback — no waiting on server roundtrip.
	const [localPrivacy, setLocalPrivacy] = useState<string>(privacyLevel ?? "")
	const [localEnabled, setLocalEnabled] = useState(disclosure?.enabled ?? false)
	const [localBrandOrganic, setLocalBrandOrganic] = useState(
		disclosure?.brand_organic ?? false,
	)
	const [localBrandedContent, setLocalBrandedContent] = useState(
		disclosure?.branded_content ?? false,
	)

	// Re-sync only when the user switches to a different channel destination.
	const prevChannelId = useRef(channelId)
	useEffect(() => {
		if (prevChannelId.current === channelId) return
		prevChannelId.current = channelId
		setLocalPrivacy(privacyLevel ?? "")
		setLocalEnabled(disclosure?.enabled ?? false)
		setLocalBrandOrganic(disclosure?.brand_organic ?? false)
		setLocalBrandedContent(disclosure?.branded_content ?? false)
	}, [channelId, privacyLevel, disclosure])

	const optionsQuery = useQuery({
		queryKey: ["tiktok-publish-options", channelId],
		queryFn: () => getTiktokPublishOptionsFn({ data: { channelId } }),
		staleTime: 5 * 60 * 1000,
	})

	const privacyOptions =
		optionsQuery.data?.ok ? optionsQuery.data.privacyLevelOptions : []

	const disclosureIncomplete =
		localEnabled && !localBrandOrganic && !localBrandedContent

	function handlePrivacyChange(level: string) {
		setLocalPrivacy(level)
		onPrivacyLevelChange(level)
	}

	function handleDisclosureEnabledChange(next: boolean) {
		const brandOrganic = next ? localBrandOrganic : false
		const brandedContent = next ? localBrandedContent : false
		setLocalEnabled(next)
		setLocalBrandOrganic(brandOrganic)
		setLocalBrandedContent(brandedContent)
		onDisclosureChange({
			enabled: next,
			brand_organic: brandOrganic,
			branded_content: brandedContent,
		})
	}

	function handleBrandOrganicChange(next: boolean) {
		setLocalBrandOrganic(next)
		onDisclosureChange({
			enabled: localEnabled,
			brand_organic: next,
			branded_content: localBrandedContent,
		})
	}

	function handleBrandedContentChange(next: boolean) {
		setLocalBrandedContent(next)
		onDisclosureChange({
			enabled: localEnabled,
			brand_organic: localBrandOrganic,
			branded_content: next,
		})
	}

	return (
		<div className="space-y-5">
			{/* Default privacy level */}
			<div className="space-y-1.5">
				<p className="text-sm font-medium text-foreground">Default visibility</p>
				<p className="text-sm text-muted-foreground">
					Who can see videos posted to this TikTok account by default.
				</p>

				{optionsQuery.isPending ? (
					<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
						<Loader2 className="size-3.5 animate-spin" />
						Loading account options…
					</div>
				) : optionsQuery.data && !optionsQuery.data.ok ? (
					<p className="text-sm text-muted-foreground">
						{optionsQuery.data.code === "no_token" ||
						optionsQuery.data.code === "token_invalid"
							? "Connect your TikTok account above to configure posting defaults."
							: optionsQuery.data.code === "post_cap_reached"
								? "Daily post limit reached — options unavailable until tomorrow."
								: "Could not load visibility options. Check your TikTok connection."}
					</p>
				) : (
					<Select
						value={localPrivacy}
						onValueChange={handlePrivacyChange}
						disabled={privacyOptions.length === 0}
					>
						<SelectTrigger size="sm" className="w-full max-w-xs text-sm">
							<SelectValue placeholder="Select default visibility…" />
						</SelectTrigger>
						<SelectContent>
							{privacyOptions.map((level) => (
								<SelectItem key={level} value={level}>
									{tiktokPrivacyLabel(level)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
			</div>

			{/* Commercial content disclosure */}
			<div className="space-y-2">
				<p className="text-sm font-medium text-foreground">
					Commercial content disclosure
				</p>
				<p className="text-sm text-muted-foreground">
					Required by TikTok when videos promote a brand, product, or service.
					This default applies to all auto-posted videos on this destination.
				</p>

				<label className="flex cursor-pointer items-start gap-2.5">
					<input
						type="checkbox"
						className="mt-0.5 shrink-0"
						checked={localEnabled}
						onChange={(e) => handleDisclosureEnabledChange(e.target.checked)}
					/>
					<span className="text-sm leading-relaxed text-foreground">
						<span className="font-medium">Disclose video content</span>
						<span className="ml-1 text-muted-foreground">
							— indicate if videos promote a brand, product, or service
						</span>
					</span>
				</label>

				{localEnabled ? (
					<div className="ml-6 space-y-1.5 rounded-md border border-border bg-background px-3 py-2.5">
						<label className="flex cursor-pointer items-start gap-2.5">
							<input
								type="checkbox"
								className="mt-0.5 shrink-0"
								checked={localBrandOrganic}
								onChange={(e) => handleBrandOrganicChange(e.target.checked)}
							/>
							<span className="text-sm leading-relaxed text-foreground">
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
								checked={localBrandedContent}
								onChange={(e) => handleBrandedContentChange(e.target.checked)}
							/>
							<span className="text-sm leading-relaxed text-foreground">
								<span className="font-medium">Branded content</span>
								<span className="ml-1 text-muted-foreground">
									— you promote another brand or a third party
								</span>
							</span>
						</label>
						{disclosureIncomplete ? (
							<p className="text-xs text-destructive">
								Select at least one option.
							</p>
						) : null}
						{localBrandedContent || localBrandOrganic ? (
							<p className="text-xs text-muted-foreground">
								Videos will be labeled as &ldquo;
								{localBrandedContent
									? "Paid partnership"
									: "Promotional content"}
								&rdquo;
							</p>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	)
}
