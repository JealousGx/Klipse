import { FeedbackButton } from "@/components/feedback"
import { BrandLogo } from "@/components/shared/BrandLogo"
import { Link } from "@/components/ui/link"
import { Separator } from "@/components/ui/separator"
import { siteConfig } from "@/config/site"

const legalLinks = [
	{ to: "/terms", label: "Terms" },
	{ to: "/privacy", label: "Privacy" },
	{ to: "/refund", label: "Refund" },
] as const

export default function Footer() {
	const year = new Date().getFullYear()

	return (
		<footer className="relative border-t border-border/80 bg-gradient-to-b from-muted/25 to-muted/40 dark:from-muted/15 dark:to-muted/25">
			<div
				className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
				aria-hidden
			/>
			<div className="page-wrap px-4 py-14 sm:px-6 lg:px-8">
				<div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between md:gap-12">
					<div className="max-w-md">
						<BrandLogo size="md" withText className="text-foreground" to="/" />
						<p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
							{siteConfig.tagline}
						</p>
					</div>
					<nav
						className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1"
						aria-label="Legal"
					>
						{legalLinks.map(({ to, label }) => (
							<Link
								key={to}
								to={to}
								variant="link"
								className="h-auto min-h-0 justify-start px-0 text-sm font-medium text-foreground no-underline hover:text-foreground hover:underline sm:px-2"
							>
								{label}
							</Link>
						))}
					</nav>
				</div>
				<Separator className="my-8" />
				<div className="flex items-center justify-between gap-4">
					<p className="m-0 text-xs font-medium text-muted-foreground">
						© {year} {siteConfig.name}. All rights reserved.
					</p>
					<FeedbackButton />
				</div>
			</div>
		</footer>
	)
}
