import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Check,
	Coins,
	Layers,
	MonitorPlay,
	RefreshCw,
	Server,
	Sparkles,
	Target,
} from "lucide-react";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: LandingPage });

const outcomes = [
	{
		title: "Publish-ready videos",
		body: "Finished cuts—not loose drafts you still have to fix in an editor.",
	},
	{
		title: "Platform-optimized hooks",
		body: "Outputs tuned for Shorts, Reels, and TikTok—not one generic aspect ratio.",
	},
	{
		title: "Scheduled distribution",
		body: "Systemized publish steps so releases land when your audience is watching.",
	},
	{
		title: "Full pipeline visibility",
		body: "See every stage, every run, every failure—then retry without starting over.",
	},
] as const;

const differentiation = [
	{
		title: "Queue-first architecture",
		body: "Jobs survive restarts. No mystery timeouts—no half-finished runs stuck in limbo.",
		icon: Server,
	},
	{
		title: "Platform-native generation",
		body: "Blueprints and metadata match how each platform expects titles, tags, and disclosure.",
		icon: Layers,
	},
	{
		title: "Operator workflows",
		body: "Retries, logs, and observability for people who run channels—not one-off experiments.",
		icon: MonitorPlay,
	},
	{
		title: "Hybrid pricing (credits + subscription)",
		body: "Subscription for the system; credits for burst usage—predictable as you scale.",
		icon: Coins,
	},
] as const;

const pipeline = [
	{
		phase: "Input",
		title: "Script or idea",
		body: "Drop a brief or full script—your channel blueprint drives tone and structure.",
		status: "Queued → accepted",
	},
	{
		phase: "Generation",
		title: "Scenes, voice, visuals",
		body: "Staged renders with fallbacks so a bad asset does not kill the whole job.",
		status: "Processing with retries",
	},
	{
		phase: "Assembly",
		title: "Timing + hooks",
		body: "Cut to length, punchy openers, and CTA beats for vertical feeds.",
		status: "Review or auto-merge",
	},
	{
		phase: "Publish",
		title: "YouTube / Reels / TikTok",
		body: "Schedule or push live with platform-specific metadata and disclosure hooks.",
		status: "Done or retry publish",
	},
] as const;

const pricingTiers = [
	{
		name: "Free",
		price: "$0",
		period: "",
		highlight: "Try the system",
		features: [
			"1 video / month",
			"Watermark",
			"Queue + job visibility",
			"Single channel",
		],
		cta: "Start free",
		emphasis: false,
	},
	{
		name: "Starter",
		price: "$29",
		period: "/mo",
		highlight: "Solo operators",
		features: [
			"No watermark",
			"Multi-step pipelines",
			"Credits bundle included",
			"Email support",
		],
		cta: "Get started",
		emphasis: false,
	},
	{
		name: "Pro",
		price: "$99",
		period: "/mo",
		highlight: "Serious volume",
		features: [
			"Higher credit caps",
			"Multiple channels",
			"Priority queue",
			"Exports & webhooks (roadmap)",
		],
		cta: "Get started",
		emphasis: true,
	},
	{
		name: "Scale",
		price: "Custom",
		period: "",
		highlight: "Teams & networks",
		features: [
			"Volume pricing",
			"SLA options",
			"Dedicated support",
			"Custom integrations",
		],
		cta: "Talk to us",
		emphasis: false,
	},
] as const;

function ProductStoryMock() {
	return (
		<section
			className="overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm"
			aria-label="Product interface preview"
		>
			<div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
				<div className="flex items-center gap-2">
					<span className="font-heading text-sm font-semibold text-foreground">
						Render queue
					</span>
					<span className="rounded border border-border bg-background px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
						4 jobs
					</span>
				</div>
				<button
					type="button"
					className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground"
					tabIndex={-1}
					aria-hidden
				>
					<RefreshCw className="h-3.5 w-3.5" aria-hidden />
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
								className="rounded-md border border-border bg-background px-2 py-1 text-[10px] font-semibold text-foreground"
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
							<div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-foreground/20 bg-background shadow-sm">
								<div className="ml-0.5 h-0 w-0 border-y-[10px] border-l-[14px] border-y-transparent border-l-foreground" />
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
								{["shorts", "finance", "hook", "Q4"].map((tag) => (
									<span
										key={tag}
										className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground"
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
								className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-sm"
								tabIndex={-1}
								aria-hidden
							>
								<RefreshCw className="h-3.5 w-3.5" aria-hidden />
								Retry publish
							</button>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

function LandingPage() {
	return (
		<main>
			{/* Hook: pain → solution */}
			<section className="border-b border-border">
				<div className="page-wrap px-4 py-24 sm:px-6 lg:px-8">
					<div className="max-w-3xl">
						<p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
							Content infrastructure for operators
						</p>
						<h1 className="font-heading mt-4 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
							Build and run AI video channels—end to end.
						</h1>
						<p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
							Script → generate → schedule → publish. Queue-driven pipelines
							that don&apos;t break at scale—so you replace the whole content
							machine, not just the generator.
						</p>
						<p className="mt-6 text-sm font-medium text-foreground">
							Built for operators running multi-platform content systems.
						</p>
						<div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
							<Link
								to="/dashboard/generate"
								className={cn(
									"inline-flex min-h-11 items-center justify-center rounded-lg px-7 text-sm font-semibold no-underline transition",
									"bg-primary text-primary-foreground shadow-sm hover:opacity-95 active:opacity-90",
								)}
							>
								Start generating
							</Link>
							<a
								href="#product"
								className={cn(
									"inline-flex min-h-11 items-center justify-center rounded-lg border-2 border-foreground bg-background px-7 text-sm font-semibold text-foreground no-underline transition",
									"hover:bg-muted",
								)}
							>
								View demo
							</a>
							<Link
								to="/"
								search={{ auth: "login" }}
								className="text-center text-sm font-medium text-muted-foreground no-underline underline-offset-4 hover:text-foreground sm:ml-2 sm:text-left"
							>
								Sign in
							</Link>
						</div>
					</div>
				</div>
			</section>

			{/* Outcome: what they get */}
			<section className="border-b border-border bg-muted/30">
				<div className="page-wrap px-4 py-24 sm:px-6 lg:px-8">
					<div className="max-w-2xl">
						<h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
							What you get
						</h2>
						<p className="mt-3 text-lg text-muted-foreground">
							One system that covers the outcome—not a pile of disconnected AI
							tools.
						</p>
					</div>
					<ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:gap-8">
						{outcomes.map((item) => (
							<li
								key={item.title}
								className="flex gap-4 rounded-xl border border-border bg-card p-5 shadow-sm"
							>
								<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-primary">
									<Check className="h-4 w-4 stroke-[2.5]" aria-hidden />
								</span>
								<div>
									<h3 className="font-heading font-semibold text-foreground">
										{item.title}
									</h3>
									<p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
										{item.body}
									</p>
								</div>
							</li>
						))}
					</ul>
				</div>
			</section>

			{/* Proof: real product story */}
			<section id="product" className="scroll-mt-20 border-b border-border">
				<div className="page-wrap px-4 py-24 sm:px-6 lg:px-8">
					<div className="grid items-start gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
						<div>
							<h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
								Your whole pipeline, visible
							</h2>
							<p className="mt-4 text-pretty text-lg text-muted-foreground">
								Queue states, failures, and retries are first-class—not buried
								in logs. When something breaks, you fix the run, not your
								afternoon.
							</p>
							<ul className="mt-8 space-y-4 text-sm text-foreground">
								<li className="flex gap-3">
									<Target
										className="mt-0.5 h-5 w-5 shrink-0 text-primary"
										aria-hidden
									/>
									<span>
										<strong className="font-semibold">
											See status at a glance:
										</strong>{" "}
										Queued, Processing, Failed, Done—mapped to real jobs.
									</span>
								</li>
								<li className="flex gap-3">
									<Sparkles
										className="mt-0.5 h-5 w-5 shrink-0 text-primary"
										aria-hidden
									/>
									<span>
										<strong className="font-semibold">
											Preview + metadata:
										</strong>{" "}
										Title, tags, and platform before anything goes live.
									</span>
								</li>
								<li className="flex gap-3">
									<RefreshCw
										className="mt-0.5 h-5 w-5 shrink-0 text-primary"
										aria-hidden
									/>
									<span>
										<strong className="font-semibold">
											Retry without redo:
										</strong>{" "}
										Recover failed stages instead of regenerating from scratch.
									</span>
								</li>
							</ul>
						</div>
						<ProductStoryMock />
					</div>
				</div>
			</section>

			{/* Differentiation */}
			<section className="border-b border-border bg-muted/30">
				<div className="page-wrap px-4 py-24 sm:px-6 lg:px-8">
					<div className="max-w-2xl">
						<h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
							Why Klipse is different
						</h2>
						<p className="mt-3 text-lg text-muted-foreground">
							Designed for creators running serious volume—not weekend
							experiments.
						</p>
					</div>
					<div className="mt-12 grid gap-6 md:grid-cols-2 lg:gap-8">
						{differentiation.map((item) => {
							const Icon = item.icon;
							return (
								<article
									key={item.title}
									className="rounded-xl border border-border bg-card p-6 shadow-sm"
								>
									<div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-primary">
										<Icon className="h-5 w-5" aria-hidden />
									</div>
									<h3 className="font-heading mt-4 text-lg font-semibold text-foreground">
										{item.title}
									</h3>
									<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
										{item.body}
									</p>
								</article>
							);
						})}
					</div>
				</div>
			</section>

			{/* System: pipeline */}
			<section className="border-b border-border">
				<div className="page-wrap px-4 py-24 sm:px-6 lg:px-8">
					<div className="max-w-2xl">
						<h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
							Built to handle real content volume
						</h2>
						<p className="mt-3 text-lg text-muted-foreground">
							Four stages from idea to platform—with explicit status and retry
							at each handoff.
						</p>
					</div>
					<ol className="mt-12 grid gap-6 lg:grid-cols-4 lg:gap-8">
						{pipeline.map((step, i) => (
							<li
								key={step.phase}
								className="relative rounded-xl border border-border bg-card p-5 shadow-sm"
							>
								<span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
									{String(i + 1).padStart(2, "0")}
								</span>
								<p className="mt-1 text-xs font-semibold uppercase tracking-wide text-primary">
									{step.phase}
								</p>
								<h3 className="font-heading mt-2 text-lg font-semibold text-foreground">
									{step.title}
								</h3>
								<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
									{step.body}
								</p>
								<p className="mt-4 border-t border-border pt-3 font-mono text-[10px] leading-snug text-foreground">
									{step.status}
								</p>
							</li>
						))}
					</ol>
				</div>
			</section>

			{/* Pricing */}
			<section className="border-b border-border bg-muted/30">
				<div className="page-wrap px-4 py-24 sm:px-6 lg:px-8">
					<div className="max-w-2xl">
						<h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
							Pricing that matches how you operate
						</h2>
						<p className="mt-3 text-lg text-muted-foreground">
							Start free, graduate when volume justifies it. Final numbers may
							adjust at launch—tiers and limits stay aligned with this
							structure.
						</p>
					</div>
					<div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
						{pricingTiers.map((tier) => (
							<div
								key={tier.name}
								className={cn(
									"flex flex-col rounded-xl border bg-card p-6 shadow-sm",
									tier.emphasis
										? "border-foreground/25 ring-2 ring-foreground/10"
										: "border-border",
								)}
							>
								<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									{tier.highlight}
								</p>
								<h3 className="font-heading mt-2 text-xl font-bold text-foreground">
									{tier.name}
								</h3>
								<p className="mt-3 flex items-baseline gap-0.5">
									<span className="text-3xl font-bold tracking-tight text-foreground">
										{tier.price}
									</span>
									{tier.period ? (
										<span className="text-sm text-muted-foreground">
											{tier.period}
										</span>
									) : null}
								</p>
								<ul className="mt-6 flex flex-1 flex-col gap-2.5 text-sm text-muted-foreground">
									{tier.features.map((f) => (
										<li key={f} className="flex gap-2">
											<Check
												className="mt-0.5 h-4 w-4 shrink-0 text-foreground"
												aria-hidden
											/>
											<span>{f}</span>
										</li>
									))}
								</ul>
								{tier.name === "Scale" ? (
									<a
										href={`mailto:${siteConfig.supportEmail}?subject=Klipse%20Scale`}
										className="mt-8 inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-center text-sm font-semibold text-foreground no-underline transition hover:bg-muted"
									>
										{tier.cta}
									</a>
								) : (
									<Link
										to="/"
										search={{ auth: "signup" }}
										className={cn(
											"mt-8 inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-center text-sm font-semibold no-underline transition",
											tier.emphasis
												? "bg-primary text-primary-foreground hover:opacity-95"
												: "border border-border bg-background font-semibold text-foreground hover:bg-muted",
										)}
									>
										{tier.cta}
									</Link>
								)}
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Final CTA */}
			<section className="bg-primary px-4 py-24 text-primary-foreground sm:px-6 lg:px-8">
				<div className="page-wrap">
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
							Start your first video pipeline
						</h2>
						<p className="mt-4 text-pretty text-lg text-primary-foreground/90">
							No setup. No manual editing. Sign in and run a job through the
							same queue your production account will use.
						</p>
						<div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
							<Link
								to="/dashboard/generate"
								className="inline-flex min-h-11 min-w-48 items-center justify-center rounded-lg border border-primary-foreground/30 bg-primary-foreground px-8 text-sm font-semibold text-primary no-underline shadow-sm transition hover:bg-primary-foreground/95"
							>
								Start generating
							</Link>
							<Link
								to="/"
								search={{ auth: "login" }}
								className="text-sm font-semibold text-primary-foreground/95 underline-offset-4 hover:text-primary-foreground"
							>
								I already have an account
							</Link>
						</div>
					</div>
				</div>
			</section>
		</main>
	);
}
