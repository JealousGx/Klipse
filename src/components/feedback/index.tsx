import { Bug, Lightbulb, MessageSquare, Users } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { siteConfig } from "@/config/site";

import { env } from "@/env";

import { cn } from "@/lib/utils";

import { BugReportDialog } from "./BugReportDialog";

export function FeedbackButton({ className }: { className?: string }) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [bugDialogOpen, setBugDialogOpen] = useState(false);

	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function onClickOutside(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setMenuOpen(false);
			}
		}
		if (menuOpen) document.addEventListener("mousedown", onClickOutside);
		return () => document.removeEventListener("mousedown", onClickOutside);
	}, [menuOpen]);

	return (
		<React.Fragment>
			<div className={cn("relative", className)} ref={ref}>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => setMenuOpen((v) => !v)}
					className="h-8 w-full justify-start gap-2 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
				>
					<MessageSquare className="size-3.5 shrink-0" />
					Feedback
				</Button>

				{menuOpen ? (
					<div className="absolute bottom-full left-0 mb-2 w-56 rounded-xl border border-border/60 bg-background p-1.5 shadow-lg">
						<button
							type="button"
							className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60"
							onClick={() => {
								setMenuOpen(false);
								setBugDialogOpen(true);
							}}
							aria-label="Report a bug or describe an issue"
						>
							<Bug className="size-4 shrink-0 text-destructive" />
							<div>
								<p className="font-medium text-foreground">Report a Bug</p>
								<p className="text-xs text-muted-foreground">
									Describe the issue
								</p>
							</div>
						</button>
						<a
							href={env.VITE_APP_FEATURE_BASE_URL}
							className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted/60"
							target="_blank"
							rel="noopener noreferrer"
							onClick={() => setMenuOpen(false)}
						>
							<Lightbulb className="size-4 shrink-0 text-chart-4" />
							<div>
								<p className="font-medium text-foreground">Suggest a Feature</p>
								<p className="text-xs text-muted-foreground">via FeatureBase</p>
							</div>
						</a>
						{siteConfig.discord ? (
							<a
								href={siteConfig.discord}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted/60"
								onClick={() => setMenuOpen(false)}
							>
								<Users className="size-4 shrink-0 text-primary" />
								<div>
									<p className="font-medium text-foreground">
										Join the Community
									</p>
									<p className="text-xs text-muted-foreground">
										Discord server
									</p>
								</div>
							</a>
						) : null}
					</div>
				) : null}
			</div>

			{bugDialogOpen && (
				<BugReportDialog open={bugDialogOpen} onOpenChange={setBugDialogOpen} />
			)}
		</React.Fragment>
	);
}
