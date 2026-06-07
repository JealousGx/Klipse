import type { ReactNode } from "react"

import { DashboardPanel } from "@/components/dashboard/dashboard-panel"

import { DestinationInternalIdFields } from "./destination-internal-id-card"
import { DestinationRemoveFields } from "./destination-remove-card"

type Props = {
	destinationId: string
	oauthConnected: boolean
	onRemoveClick: () => void
	isRemovePending: boolean
}

function WidgetLabel({ children }: { children: ReactNode }) {
	return (
		<p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
			{children}
		</p>
	)
}

/**
 * Sticky column: section jumps, internal id, remove — avoids repeating body content.
 */
export function PublishingDestinationWidgets({
	destinationId,
	oauthConnected,
	onRemoveClick,
	isRemovePending,
}: Props) {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<WidgetLabel>On this page</WidgetLabel>
				<DashboardPanel variant="muted" className="px-4 py-4 md:px-5">
					<nav
						className="flex flex-col gap-2 text-xs"
						aria-label="Jump to section"
					>
						<a
							href="#connection"
							className="font-medium text-foreground/90 underline-offset-4 hover:underline"
						>
							Publishing account
						</a>
						{oauthConnected ? (
							<a
								href="#connected-channel"
								className="font-medium text-foreground/90 underline-offset-4 hover:underline"
							>
								Connected channel
							</a>
						) : null}
						<a
							href="#posting-schedule"
							className="font-medium text-foreground/90 underline-offset-4 hover:underline"
						>
							Posting schedule
						</a>
						<a
							href="#destination-details"
							className="font-medium text-foreground/90 underline-offset-4 hover:underline"
						>
							Name & niche in Klipse
						</a>
					</nav>
				</DashboardPanel>
			</div>

			<div>
				<WidgetLabel>Internal destination id</WidgetLabel>
				<DashboardPanel variant="muted" className="px-4 py-4 md:px-5">
					<p className="mb-3 text-xs leading-relaxed text-muted-foreground">
						Use in API calls and integrations.
					</p>
					<DestinationInternalIdFields destinationId={destinationId} />
				</DashboardPanel>
			</div>

			<div>
				<WidgetLabel>Danger zone</WidgetLabel>
				<DashboardPanel variant="danger" className="px-4 py-4 md:px-5">
					<p className="mb-3 text-xs leading-relaxed text-muted-foreground">
						Permanently delete this slot. This cannot be undone.
					</p>
					<DestinationRemoveFields
						isRemoving={isRemovePending}
						onRemove={onRemoveClick}
						className="w-full"
					/>
				</DashboardPanel>
			</div>
		</div>
	)
}
