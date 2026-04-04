import { createFileRoute } from "@tanstack/react-router";
import {
	CalendarClock,
	Check,
	Coins,
	Eye,
	Layers,
	MonitorPlay,
	RefreshCw,
	Server,
	Share2,
	Sparkles,
	Target,
	Video,
} from "lucide-react";

import { GetStartedButton } from "@/components/get-started-button";
import {
	PipelineObservabilityPanel,
	ProductStoryMock,
} from "@/components/landing";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Link } from "@/components/ui/link";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: LandingPage });

const outcomes = [
	{
		title: "Publish-ready videos",
		body: "Finished cuts—not loose drafts you still have to fix in an editor.",
		icon: Video,
	},
	{
		title: "Platform-optimized hooks",
		body: "Outputs tuned for Shorts, Reels, and TikTok—not one generic aspect ratio.",
		icon: Share2,
	},
	{
		title: "Scheduled distribution",
		body: "Systemized publish steps so releases land when your audience is watching.",
		icon: CalendarClock,
	},
	{
		title: "Full pipeline visibility",
		body: "See every stage, every run, every failure—then retry without starting over.",
		icon: Eye,
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
			"1 video for lifetime",
			"Max 30 sec",
			"No auto-post",
			"No download (preview only or low-res)",
			"Expires after 24h",
			"Queue priority: lowest",
			"Models: cheapest only",
		],
		cta: "Start free",
		emphasis: false,
	},
	{
		name: "Starter",
		price: "$19",
		period: "/mo",
		highlight: "Solo operators",
		features: [
			"~1,000 credits (~40 shorts)",
			"1 channel",
			"Max 30 sec videos",
			"Auto-post (YouTube only)",
			"Basic analytics",
			"Standard queue priority",
			"No watermark",
			"Email support",
			"Ability to buy more credits",
		],
		cta: "Get started",
		emphasis: false,
	},
	{
		name: "Creator",
		price: "$49",
		period: "/mo",
		highlight: "Serious volume",
		features: [
			"~5,000 credits (~200 shorts or mixed)",
			"3 channels",
			"Max 60 sec videos",
			"Auto-post + scheduling",
			"Manual approval toggle",
			"Better TTS + visuals",
			"Medium queue priority",
		],
		cta: "Get started",
		emphasis: true,
	},
	{
		name: "Empire",
		price: "$99",
		period: "/mo",
		highlight: "Teams & networks",
		features: [
			"~15,000 credits (~600 shorts or mixed)",
			"10 channels",
			"Long-form support",
			"Priority rendering",
			"Premium models (Kling, Google TTS priority)",
			"Advanced analytics (future-ready)",
			"Highest queue priority",
		],
		cta: "Get Started",
		emphasis: false,
	},
] as const;

function LandingPage() {
	return (
		<main className="bg-background">
			{/* Hook: pain → solution */}
			<section className="relative overflow-hidden border-b border-border/80">
				<div className="landing-mesh" aria-hidden>
					<div className="landing-mesh-blob-a" />
					<div className="landing-mesh-blob-b" />
					<div className="landing-mesh-blob-c" />
					<div className="landing-grid" />
				</div>
				<div className="page-wrap relative z-10 px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
					<div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16 xl:gap-20">
						<Card className="min-w-0 max-w-3xl border-0 bg-transparent p-0 shadow-none">
							<CardHeader className="p-0">
								<Badge
									variant="outline"
									className="w-fit border-primary/30 bg-primary/6 text-xs font-semibold uppercase tracking-[0.18em] text-primary shadow-sm shadow-primary/5"
								>
									Content infrastructure for operators
								</Badge>
								<CardTitle className="font-heading mt-5 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-[3.35rem] lg:leading-[1.06]">
									Build and run{" "}
									<span className="bg-linear-to-r from-primary via-primary to-chart-2 bg-clip-text text-transparent">
										AI video channels
									</span>
									—end to end.
								</CardTitle>
								<CardDescription className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
									Script → generate → schedule → publish. Queue-driven pipelines
									that don&apos;t break at scale—so you replace the whole
									content machine, not just the generator.
								</CardDescription>
							</CardHeader>
							<CardContent className="p-0 pt-7">
								<p className="text-sm font-medium text-foreground/90">
									Built for operators running multi-platform content systems.
								</p>
								<div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
									<GetStartedButton variant="hero" />
								</div>
							</CardContent>
						</Card>
						<div
							id="product"
							className="min-w-0 scroll-mt-28 lg:justify-self-end"
						>
							<div className="relative">
								<div
									className="pointer-events-none absolute -inset-1 rounded-2xl bg-linear-to-br from-primary/20 via-transparent to-chart-2/15 opacity-90 blur-xl dark:from-primary/25 dark:to-chart-2/10"
									aria-hidden
								/>
								<div className="relative rounded-2xl shadow-2xl shadow-black/6 ring-1 ring-border/60 dark:shadow-black/40">
									<ProductStoryMock />
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Outcome: what they get */}
			<section className="relative border-b border-border/80 bg-linear-to-b from-muted/35 via-background to-background dark:from-muted/20">
				<div className="page-wrap px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
					<Card className="mb-12 max-w-2xl border-0 bg-transparent p-0 shadow-none sm:mb-16">
						<CardHeader className="p-0">
							<CardTitle className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
								What you get
							</CardTitle>
							<CardDescription className="text-lg text-muted-foreground">
								One system that covers the outcome—not a pile of disconnected AI
								tools.
							</CardDescription>
						</CardHeader>
					</Card>
					<ul className="grid list-none gap-6 p-0 sm:grid-cols-2 lg:gap-8">
						{outcomes.map((item) => {
							const Icon = item.icon;
							return (
								<li key={item.title} className="h-full">
									<Card className="group flex h-full flex-col border-border/70 bg-card/80 shadow-sm ring-1 ring-border/40 transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-md dark:bg-card/60">
										<CardContent className="grid grid-cols-[auto_1fr] items-start gap-4">
											<span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-linear-to-br from-background to-muted/40 text-primary shadow-sm">
												<Icon className="size-5" aria-hidden />
											</span>
											<div className="min-w-0 space-y-1.5">
												<CardTitle className="font-heading text-base font-semibold leading-snug text-foreground">
													{item.title}
												</CardTitle>
												<p className="text-sm leading-relaxed text-muted-foreground">
													{item.body}
												</p>
											</div>
										</CardContent>
									</Card>
								</li>
							);
						})}
					</ul>
				</div>
			</section>

			{/* Proof: narrative + observability (demo mock lives in hero / #product) */}
			<section className="border-b border-border/80 bg-background">
				<div className="page-wrap px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
					<div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-14">
						<div className="min-w-0 max-w-3xl space-y-8">
							<div className="space-y-4">
								<h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
									Your whole pipeline, visible
								</h2>
								<p className="text-pretty text-lg leading-relaxed text-muted-foreground">
									Queue states, failures, and retries are first-class—not buried
									in logs. When something breaks, you fix the run, not your
									afternoon.
								</p>
							</div>
							<ul className="space-y-4 text-sm leading-relaxed text-foreground">
								<li className="flex gap-3">
									<Target
										className="mt-0.5 size-5 shrink-0 text-primary"
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
										className="mt-0.5 size-5 shrink-0 text-primary"
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
										className="mt-0.5 size-5 shrink-0 text-primary"
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
						<div className="min-w-0 lg:sticky lg:top-24">
							<PipelineObservabilityPanel />
						</div>
					</div>
				</div>
			</section>

			{/* Differentiation */}
			<section className="border-b border-border/80 bg-linear-to-b from-muted/30 to-muted/15 dark:from-muted/15 dark:to-background/80">
				<div className="page-wrap px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
					<Card className="mb-12 max-w-2xl border-0 bg-transparent p-0 shadow-none sm:mb-16">
						<CardHeader className="p-0">
							<CardTitle className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
								Why Klipse is different
							</CardTitle>
							<CardDescription className="text-lg text-muted-foreground">
								Designed for creators running serious volume—not weekend
								experiments.
							</CardDescription>
						</CardHeader>
					</Card>
					<div className="mt-12 grid gap-6 md:grid-cols-2 lg:gap-8">
						{differentiation.map((item) => {
							const Icon = item.icon;
							return (
								<Card
									key={item.title}
									className="border-border/70 bg-card/85 shadow-sm ring-1 ring-border/35 transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-md dark:bg-card/55"
								>
									<CardHeader>
										<div className="flex size-10 items-center justify-center rounded-xl border border-border/80 bg-linear-to-br from-background to-muted/35 text-primary shadow-sm">
											<Icon className="size-5" aria-hidden />
										</div>
										<CardTitle className="font-heading text-lg">
											{item.title}
										</CardTitle>
										<CardDescription className="text-sm leading-relaxed">
											{item.body}
										</CardDescription>
									</CardHeader>
								</Card>
							);
						})}
					</div>
				</div>
			</section>

			{/* System: pipeline */}
			<section className="border-b border-border/80 bg-background">
				<div className="page-wrap px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
					<Card className="mb-12 max-w-2xl border-0 bg-transparent p-0 shadow-none sm:mb-16">
						<CardHeader className="p-0">
							<CardTitle className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
								Built to handle real content volume
							</CardTitle>
							<CardDescription className="text-lg text-muted-foreground">
								Four stages from idea to platform—with explicit status and retry
								at each handoff.
							</CardDescription>
						</CardHeader>
					</Card>
					<ol className="mt-12 grid list-none items-stretch gap-6 p-0 lg:grid-cols-4 lg:gap-8">
						{pipeline.map((step, i) => (
							<li key={step.phase} className="h-full">
								<Card className="flex h-full flex-col gap-0 border-border/70 bg-card/90 py-5 shadow-sm ring-1 ring-border/30 backdrop-blur-[2px] transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-md dark:bg-card/65">
									<CardHeader className="px-5 pb-2 pt-0">
										<Badge
											variant="outline"
											className="w-fit font-mono text-[10px] uppercase"
										>
											{String(i + 1).padStart(2, "0")}
										</Badge>
										<p className="text-xs font-semibold uppercase tracking-wide text-primary">
											{step.phase}
										</p>
										<CardTitle className="font-heading text-lg leading-snug">
											{step.title}
										</CardTitle>
									</CardHeader>
									<CardContent className="flex flex-1 flex-col px-5 pb-0 pt-0">
										<p className="flex-1 text-sm leading-relaxed text-muted-foreground">
											{step.body}
										</p>
										<p className="mt-auto border-t border-border pt-3 font-mono text-[10px] leading-snug text-foreground">
											{step.status}
										</p>
									</CardContent>
								</Card>
							</li>
						))}
					</ol>
				</div>
			</section>

			{/* Pricing */}
			<section className="border-b border-border/80 bg-linear-to-b from-muted/25 via-muted/10 to-background dark:from-muted/12">
				<div className="page-wrap px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
					<Card className="mb-12 max-w-2xl border-0 bg-transparent p-0 shadow-none sm:mb-16">
						<CardHeader className="p-0">
							<CardTitle className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
								Pricing that matches how you operate
							</CardTitle>
							<CardDescription className="text-lg text-muted-foreground">
								Start free, graduate when volume justifies it. Final numbers may
								adjust at launch—tiers and limits stay aligned with this
								structure.
							</CardDescription>
						</CardHeader>
					</Card>
					<div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
						{pricingTiers.map((tier) => (
							<Card
								key={tier.name}
								className={cn(
									"flex flex-col gap-0 border-border/70 bg-card/90 py-6 shadow-sm ring-1 ring-border/35 backdrop-blur-sm transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 dark:bg-card/60",
									tier.emphasis
										? "border-primary/35 shadow-lg shadow-primary/10 ring-2 ring-primary/20 dark:shadow-primary/5"
										: "hover:shadow-md",
								)}
							>
								<CardHeader className="pb-2">
									<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
										{tier.highlight}
									</p>
									<CardTitle className="font-heading text-xl">
										{tier.name}
									</CardTitle>
									<p className="flex items-baseline gap-0.5 pt-1">
										<span className="text-3xl font-bold tracking-tight text-foreground">
											{tier.price}
										</span>
										{tier.period ? (
											<span className="text-sm text-muted-foreground">
												{tier.period}
											</span>
										) : null}
									</p>
								</CardHeader>
								<CardContent className="flex flex-1 flex-col pb-2 pt-0">
									<ul className="flex flex-1 flex-col gap-2.5 text-sm text-muted-foreground">
										{tier.features.map((f) => (
											<li key={f} className="flex gap-2">
												<Check
													className="mt-0.5 size-4 shrink-0 text-foreground"
													aria-hidden
												/>
												<span>{f}</span>
											</li>
										))}
									</ul>
								</CardContent>
								<CardFooter className="border-t-0 pt-2">
									<Link
										to="/"
										search={{ auth: "signup" }}
										variant={tier.emphasis ? "default" : "outline"}
										size="lg"
										className="w-full font-semibold"
									>
										{tier.cta}
									</Link>
								</CardFooter>
							</Card>
						))}
					</div>
				</div>
			</section>

			<section className="relative overflow-hidden border-t border-border/80 bg-background px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
				<div
					className="pointer-events-none absolute inset-0 overflow-hidden"
					aria-hidden
				>
					<div className="absolute -left-1/4 top-0 h-[min(70vh,520px)] w-[70%] rounded-full bg-primary/22 blur-[100px] dark:bg-primary/14" />
					<div className="absolute -right-1/4 top-1/4 h-[min(60vh,480px)] w-[60%] rounded-full bg-chart-2/28 blur-[90px] dark:bg-chart-2/12" />
					<div className="absolute bottom-0 left-1/3 h-40 w-2/3 rounded-full bg-chart-1/18 blur-[80px] dark:bg-chart-1/10" />
					<div className="landing-grid opacity-30 dark:opacity-25" />
				</div>
				<div className="page-wrap relative z-10 mx-auto max-w-2xl text-center">
					<h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
						Start your first video pipeline
					</h2>
					<p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
						No setup. No manual editing. Sign in and run a job through the same
						queue your production account will use.
					</p>
					<div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap sm:gap-5">
						<GetStartedButton variant="hero" />
						<Separator className="sm:hidden" />
						<Link variant="outline" to="/" size="lg" search={{ auth: "login" }}>
							I already have an account
						</Link>
					</div>
				</div>
			</section>
		</main>
	);
}
