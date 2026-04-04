import { BrandLogo } from "@/components/shared/BrandLogo";
import { Separator } from "@/components/ui/separator";

import { GetStartedButton } from "./get-started-button";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
	return (
		<header className="sticky top-0 z-50 border-b border-border/80 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/65">
			<nav
				className="page-wrap flex h-14 max-w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
				aria-label="Primary"
			>
				<h2 className="m-0 flex min-w-0 flex-shrink-0 items-center text-base font-semibold tracking-tight">
					<BrandLogo size="lg" withText priority to="/" />
				</h2>
				<div className="flex shrink-0 items-center gap-2 sm:gap-3">
					<GetStartedButton variant="header" />
					<Separator orientation="vertical" className="hidden h-6 sm:block" />
					<ThemeToggle />
				</div>
			</nav>
		</header>
	);
}
