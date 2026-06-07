import { RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"

const tags = ["shorts", "finance", "hook", "Q4"] as const

export function ProductStoryMock() {
	return (
		<section
			className="overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm"
			aria-label="Product interface preview"
		>
			<div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-heading text-sm font-semibold text-foreground">
						Video queue
					</span>
					<span className="rounded border border-border bg-background px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
						4 jobs
					</span>
				</div>
				<button
					type="button"
					className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground transition hover:bg-muted"
					tabIndex={-1}
					aria-hidden
				>
					<RefreshCw className="size-3.5" aria-hidden />
					Sync
				</button>
			</div>

			<div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
				<div className="border-b border-border lg:border-b-0 lg:border-r">
					<div className="border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						Status
					</div>
					<ul className="divide-y divide-border">
						<li className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 text-sm">
							<span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
								Queued
							</span>
							<span className="min-w-0 truncate font-medium text-foreground">
								#1042 · Short hook v3
							</span>
						</li>
						<li className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 bg-primary/5 px-3 py-2.5 text-sm">
							<span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
								Processing
							</span>
							<span className="min-w-0 truncate font-medium text-foreground">
								#1041 · Weekly recap
							</span>
						</li>
						<li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 text-sm">
							<span className="rounded border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
								Failed
							</span>
							<span className="min-w-0 truncate text-foreground">
								#1040 · Product demo
							</span>
							<button
								type="button"
								className="rounded-md border border-border bg-background px-2 py-1 text-[10px] font-semibold text-foreground transition hover:bg-muted"
								tabIndex={-1}
								aria-hidden
							>
								Retry
							</button>
						</li>
						<li className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 text-sm">
							<span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
								Done
							</span>
							<span className="min-w-0 truncate text-muted-foreground">
								#1039 · Channel intro
							</span>
						</li>
					</ul>
				</div>

				<div className="flex flex-col">
					<div className="relative aspect-video w-full border-b border-border bg-muted">
						<div className="absolute inset-0 flex items-center justify-center bg-foreground/5">
							<div className="flex size-14 items-center justify-center rounded-full border-2 border-foreground/20 bg-background shadow-sm">
								<div
									className="ml-0.5 h-0 w-0 border-y-10 border-l-14 border-y-transparent border-l-foreground"
									aria-hidden
								/>
							</div>
						</div>
						<div className="absolute bottom-2 left-2 rounded border border-border/80 bg-background px-2 py-1 font-mono text-[10px] font-medium text-foreground">
							1080×1920 · 0:42
						</div>
					</div>
					<div className="space-y-3 p-4">
						<div>
							<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
								Title
							</p>
							<p className="mt-0.5 font-medium text-foreground">
								Weekly recap — Q4 growth (Shorts cut)
							</p>
						</div>
						<div>
							<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
								Tags
							</p>
							<div className="mt-1.5 flex flex-wrap gap-1.5">
								{tags.map((tag) => (
									<span
										key={tag}
										className={cn(
											"rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground",
										)}
									>
										{tag}
									</span>
								))}
							</div>
						</div>
						<div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
							<div>
								<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
									Platform
								</p>
								<p className="mt-0.5 text-sm font-semibold text-foreground">
									YouTube Shorts
								</p>
							</div>
							<button
								type="button"
								className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted"
								tabIndex={-1}
								aria-hidden
							>
								<RefreshCw className="size-3.5" aria-hidden />
								Retry publish
							</button>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
